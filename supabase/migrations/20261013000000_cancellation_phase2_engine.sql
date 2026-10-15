BEGIN;

-- =============================================================================
-- Migration: 20261013000000_cancellation_phase2_engine.sql
-- Description: Phase 2 Cancellation & Refund Calculation Engine (RPC & Functions)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Internal Pure/Stable Refund Calculation Function: compute_cancellation_refund
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_cancellation_refund(
  p_booking_id uuid,
  p_cancelled_by text DEFAULT 'tourist',
  p_force_majeure boolean DEFAULT false
)
RETURNS TABLE (
  tier text,
  deposit_refund numeric,
  fee_refund numeric,
  refund_total numeric,
  host_leg numeric,
  panaw_leg numeric,
  adjusted_host_payout numeric,
  days_before integer,
  snapshot_source text,
  reason text
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_b record;
  v_today_manila date;
  v_days_before integer;
  v_is_paid boolean;
  v_policy text;
  v_full_days integer;
  v_partial_days integer;
  v_partial_percent numeric;
  v_fee_rule text;
  v_deadline_hours integer;
  v_snap_source text := 'booking';
  v_settings record;
  v_base_deposit numeric;
  v_convenience_fee numeric;
  v_max_paid numeric;
  v_deposit_pct numeric := 0.0;
  v_fee_pct numeric := 0.0;
  v_tier text := 'none';
  v_reason text := '';
  v_deposit_refund numeric := 0.00;
  v_fee_refund numeric := 0.00;
  v_refund_total numeric := 0.00;
  v_r numeric := 0.0;
  v_payout numeric := 0.00;
  v_host_leg numeric := 0.00;
  v_panaw_leg numeric := 0.00;
  v_adjusted_host_payout numeric := 0.00;
BEGIN
  -- 1. Fetch booking record
  SELECT
    b.id,
    b.tourist_id,
    b.room_id,
    b.check_in_date,
    b.check_out_date,
    b.total_price,
    b.downpayment_amount,
    b.convenience_fee,
    b.commission_amount,
    b.deposit_payout_amount,
    b.status,
    b.payment_status,
    b.payout_status,
    b.cancellation_policy,
    b.cancellation_snapshot
  INTO v_b
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking with ID % not found.', p_booking_id;
  END IF;

  -- 2. Calendar days calculation in Asia/Manila timezone
  v_today_manila := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_days_before := v_b.check_in_date - v_today_manila;

  -- 3. Check payment status: only verified or completed bookings are eligible for cash refund
  v_is_paid := v_b.payment_status IN ('verified', 'completed');

  -- 4. Unpack terms from cancellation_snapshot
  IF v_b.cancellation_snapshot IS NOT NULL THEN
    v_policy := v_b.cancellation_snapshot->>'policy';
    v_full_days := (v_b.cancellation_snapshot->>'refund_full_days')::integer;
    v_partial_days := (v_b.cancellation_snapshot->>'refund_partial_days')::integer;
    v_partial_percent := (v_b.cancellation_snapshot->>'refund_partial_percent')::numeric;
    v_fee_rule := v_b.cancellation_snapshot->>'convenience_fee_refund_rule';
    v_deadline_hours := (v_b.cancellation_snapshot->>'host_refund_deadline_hours')::integer;
  END IF;

  -- 5. Fallback to system_settings and defaults if snapshot or any key is NULL
  IF v_policy IS NULL OR v_full_days IS NULL OR v_partial_days IS NULL OR 
     v_partial_percent IS NULL OR v_fee_rule IS NULL OR v_deadline_hours IS NULL THEN
    v_snap_source := 'fallback_settings';

    BEGIN
      SELECT 
        refund_full_days,
        refund_partial_days,
        refund_partial_percent,
        convenience_fee_refund_rule,
        host_refund_deadline_hours
      INTO v_settings
      FROM public.system_settings
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_settings := NULL;
    END;

    IF v_policy IS NULL THEN
      v_policy := coalesce(v_b.cancellation_policy, 'standard');
    END IF;
    IF v_full_days IS NULL THEN
      v_full_days := coalesce(v_settings.refund_full_days, 7);
    END IF;
    IF v_partial_days IS NULL THEN
      v_partial_days := coalesce(v_settings.refund_partial_days, 3);
    END IF;
    IF v_partial_percent IS NULL THEN
      v_partial_percent := coalesce(v_settings.refund_partial_percent, 50.0);
    END IF;
    IF v_fee_rule IS NULL THEN
      v_fee_rule := coalesce(v_settings.convenience_fee_refund_rule, 'never');
    END IF;
    IF v_deadline_hours IS NULL THEN
      v_deadline_hours := coalesce(v_settings.host_refund_deadline_hours, 72);
    END IF;
  END IF;

  -- 6. Financial bases (in Philippine Pesos)
  v_convenience_fee := coalesce(v_b.convenience_fee, 0.0);
  v_base_deposit := GREATEST(0.0, coalesce(v_b.downpayment_amount, 0.0) - v_convenience_fee);
  v_max_paid := coalesce(v_b.downpayment_amount, 0.0);

  -- 7. Determine refund percentage & tier according to policy rules
  IF NOT v_is_paid THEN
    v_tier := 'unpaid';
    v_deposit_pct := 0.0;
    v_fee_pct := 0.0;
    v_reason := 'Unpaid or unverified booking: no refund applicable.';

  ELSIF p_force_majeure THEN
    v_tier := 'force_majeure';
    v_deposit_pct := 100.0;
    v_fee_pct := 100.0;
    v_reason := 'Force majeure declared by administrator: 100% deposit and 100% convenience fee refunded.';

  ELSIF p_cancelled_by = 'host' THEN
    v_tier := 'host_cancellation';
    v_deposit_pct := 100.0;
    v_fee_pct := 100.0;
    v_reason := 'Host cancellation: 100% deposit and 100% convenience fee refunded.';

  ELSE
    -- Tourist / Guest cancellation (and Admin cancel without force majeure)
    IF v_policy = 'flexible' THEN
      IF v_days_before >= v_partial_days THEN
        v_tier := 'full';
        v_deposit_pct := 100.0;
        v_reason := format('Flexible policy: 100%% deposit refund (%s days before check-in, cutoff: %s days).', v_days_before, v_partial_days);
      ELSE
        v_tier := 'none';
        v_deposit_pct := 0.0;
        v_reason := format('Flexible policy: 0%% deposit refund (%s days before check-in, under %s days cutoff).', v_days_before, v_partial_days);
      END IF;

    ELSIF v_policy = 'standard' THEN
      IF v_days_before >= v_full_days THEN
        v_tier := 'full';
        v_deposit_pct := 100.0;
        v_reason := format('Standard policy: 100%% deposit refund (%s days before check-in, full refund window: %s+ days).', v_days_before, v_full_days);
      ELSIF v_days_before >= v_partial_days THEN
        v_tier := 'partial';
        v_deposit_pct := v_partial_percent;
        v_reason := format('Standard policy: %s%% deposit refund (%s days before check-in, partial window: %s to %s days).', v_partial_percent, v_days_before, v_partial_days, v_full_days - 1);
      ELSE
        v_tier := 'none';
        v_deposit_pct := 0.0;
        v_reason := format('Standard policy: 0%% deposit refund (%s days before check-in, under %s days cutoff).', v_days_before, v_partial_days);
      END IF;

    ELSIF v_policy = 'non_refundable' THEN
      v_tier := 'none';
      v_deposit_pct := 0.0;
      v_reason := 'Non-refundable policy: 0% deposit refund.';

    ELSE
      v_tier := 'none';
      v_deposit_pct := 0.0;
      v_reason := format('Unrecognized policy %s: 0%% deposit refund.', v_policy);
    END IF;

    -- Convenience fee refund evaluation on guest cancellation
    IF v_fee_rule = 'always' THEN
      v_fee_pct := 100.0;
    ELSIF v_fee_rule = 'full_tier_only' THEN
      IF v_deposit_pct = 100.0 THEN
        v_fee_pct := 100.0;
      ELSE
        v_fee_pct := 0.0;
      END IF;
    ELSE -- 'never'
      v_fee_pct := 0.0;
    END IF;

    IF v_fee_pct = 100.0 AND v_convenience_fee > 0 THEN
      v_reason := v_reason || ' Platform convenience fee is refunded.';
    ELSIF v_convenience_fee > 0 THEN
      v_reason := v_reason || ' Platform convenience fee is non-refundable.';
    END IF;
  END IF;

  -- 8. Compute centavo-exact rounded amounts
  IF v_is_paid THEN
    v_deposit_refund := round(v_base_deposit * (v_deposit_pct / 100.0), 2);
    v_fee_refund := round(v_convenience_fee * (v_fee_pct / 100.0), 2);
    v_refund_total := v_deposit_refund + v_fee_refund;

    -- Clamp guard: total refund can never exceed what tourist actually paid
    IF v_refund_total > v_max_paid THEN
      v_refund_total := v_max_paid;
      IF v_deposit_refund > v_max_paid THEN
        v_deposit_refund := v_max_paid;
        v_fee_refund := 0.00;
      ELSE
        v_fee_refund := v_refund_total - v_deposit_refund;
      END IF;
    END IF;
  ELSE
    v_deposit_refund := 0.00;
    v_fee_refund := 0.00;
    v_refund_total := 0.00;
  END IF;

  -- 9. Money Rules: Leg calculation based on r and payout
  -- r = deposit_refund / base_deposit (0 if base_deposit = 0)
  -- For host cancellation and force majeure, r is strictly 1.0
  IF NOT v_is_paid THEN
    v_r := 0.0;
    v_payout := 0.00;
    v_host_leg := 0.00;
    v_panaw_leg := 0.00;
    v_adjusted_host_payout := 0.00;
  ELSE
    IF p_force_majeure OR p_cancelled_by = 'host' THEN
      v_r := 1.0;
    ELSIF v_base_deposit > 0.00 THEN
      v_r := v_deposit_refund / v_base_deposit;
    ELSE
      v_r := 0.0;
    END IF;

    -- payout = deposit_payout_amount; if NULL, fallback to base_deposit - commission_amount
    IF v_b.deposit_payout_amount IS NOT NULL THEN
      v_payout := v_b.deposit_payout_amount;
    ELSE
      v_payout := GREATEST(0.00, v_base_deposit - coalesce(v_b.commission_amount, 0.00));
    END IF;

    IF v_refund_total = 0.00 THEN
      v_host_leg := 0.00;
      v_panaw_leg := 0.00;
    ELSIF v_b.payout_status IN ('deposit_paid', 'fully_paid') THEN
      -- Payout already sent to host:
      -- host_leg = round(r * payout, 2); panaw_leg = refund_total - host_leg
      v_host_leg := round(v_r * v_payout, 2);
      v_panaw_leg := v_refund_total - v_host_leg;
    ELSE
      -- Payout not yet sent (pending or null):
      -- host_leg = 0; panaw_leg = refund_total
      v_host_leg := 0.00;
      v_panaw_leg := v_refund_total;
    END IF;

    -- adjusted_host_payout_amount = payout - round(r * payout, 2)
    v_adjusted_host_payout := GREATEST(0.00, v_payout - round(v_r * v_payout, 2));
  END IF;

  RETURN QUERY SELECT
    v_tier,
    v_deposit_refund,
    v_fee_refund,
    v_refund_total,
    v_host_leg,
    v_panaw_leg,
    v_adjusted_host_payout,
    v_days_before,
    v_snap_source,
    v_reason;
END;
$$;

-- Restrict internal calculator function
REVOKE EXECUTE ON FUNCTION public.compute_cancellation_refund(uuid, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.compute_cancellation_refund(uuid, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.compute_cancellation_refund(uuid, text, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.compute_cancellation_refund(uuid, text, boolean) TO service_role;


-- -----------------------------------------------------------------------------
-- 2. Preview Estimation RPC: estimate_cancellation_refund
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estimate_cancellation_refund(
  p_booking_id uuid
)
RETURNS TABLE (
  tier text,
  deposit_refund numeric,
  fee_refund numeric,
  refund_total numeric,
  host_leg numeric,
  panaw_leg numeric,
  adjusted_host_payout numeric,
  days_before integer,
  snapshot_source text,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_caller_approved boolean;
  v_tourist_id uuid;
  v_owner_id uuid;
  v_prop_owner_id uuid;
  v_actor text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Authentication required.';
  END IF;

  -- 1. Identify caller profile
  SELECT role, is_approved INTO v_caller_role, v_caller_approved
  FROM public.profiles
  WHERE id = v_caller_id;

  -- 2. Identify booking stakeholders
  SELECT 
    b.tourist_id, 
    b.owner_id, 
    p.owner_id
  INTO 
    v_tourist_id, 
    v_owner_id, 
    v_prop_owner_id
  FROM public.bookings b
  LEFT JOIN public.rooms r ON r.id = b.room_id
  LEFT JOIN public.properties p ON p.id = r.property_id
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking with ID % not found.', p_booking_id;
  END IF;

  -- 3. Authorization check & actor derivation
  IF v_caller_role = 'admin' AND v_caller_approved = true THEN
    v_actor := 'admin';
  ELSIF v_caller_id = v_tourist_id THEN
    v_actor := 'tourist';
  ELSIF v_caller_id = v_owner_id OR v_caller_id = v_prop_owner_id THEN
    v_actor := 'host';
  ELSE
    RAISE EXCEPTION 'Access Denied: You are not authorized to view cancellation estimates for this booking.';
  END IF;

  RETURN QUERY SELECT * FROM public.compute_cancellation_refund(p_booking_id, v_actor, false);
END;
$$;

-- Grant execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.estimate_cancellation_refund(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.estimate_cancellation_refund(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.estimate_cancellation_refund(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estimate_cancellation_refund(uuid) TO service_role;


-- -----------------------------------------------------------------------------
-- 3. Atomic Cancellation RPC: cancel_booking_atomic
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_booking_atomic(
  p_booking_id uuid,
  p_reason text,
  p_force_majeure boolean DEFAULT false,
  p_refund_gcash_number text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_caller_approved boolean;
  v_actor text;
  v_b record;
  v_today_manila date;
  v_days_before integer;
  v_calc record;
  v_deadline_hours integer;
  v_host_due_at timestamptz := NULL;
  v_host_status text := 'none';
  v_panaw_status text := 'none';
  v_base_deposit numeric;
  v_r numeric := 0.0;
  v_payout numeric := 0.00;
  v_adjusted_host_payout numeric := 0.00;
  v_refund_gcash text := NULL;
  v_reason text;
  v_saved_jwt_role text;
BEGIN
  -- 1. Authentication check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Authentication required.';
  END IF;

  -- 2. Verify if caller is an approved admin
  SELECT role, is_approved INTO v_caller_role, v_caller_approved
  FROM public.profiles
  WHERE id = v_caller_id;

  IF v_caller_role = 'admin' AND v_caller_approved = true THEN
    v_actor := 'admin';
  END IF;

  -- 3. Row-Level Lock on target booking
  SELECT 
    b.id,
    b.tourist_id,
    b.owner_id,
    b.room_id,
    b.check_in_date,
    b.check_out_date,
    b.total_price,
    b.downpayment_amount,
    b.convenience_fee,
    b.commission_amount,
    b.host_payout_amount,
    b.deposit_payout_amount,
    b.status,
    b.payment_status,
    b.payout_status,
    b.cancellation_policy,
    b.cancellation_snapshot,
    b.cancelled_by,
    b.cancelled_at,
    b.cancellation_reason,
    b.refund_total,
    b.deposit_refund_amount,
    b.fee_refund_amount,
    b.host_refund_amount,
    b.host_refund_status,
    b.host_refund_due_at,
    b.panaw_refund_amount,
    b.panaw_refund_status,
    b.adjusted_host_payout_amount,
    b.refund_gcash_number,
    p.owner_id AS prop_owner_id
  INTO v_b
  FROM public.bookings b
  LEFT JOIN public.rooms r ON r.id = b.room_id
  LEFT JOIN public.properties p ON p.id = r.property_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking with ID % not found.', p_booking_id;
  END IF;

  -- 4. Derive caller actor if not admin
  IF v_actor IS NULL THEN
    IF v_caller_id = v_b.tourist_id THEN
      v_actor := 'tourist';
    ELSIF v_caller_id = v_b.owner_id OR v_caller_id = v_b.prop_owner_id THEN
      v_actor := 'host';
    ELSE
      RAISE EXCEPTION 'Access Denied: You are not authorized to cancel this booking.';
    END IF;
  END IF;

  -- 5. Force majeure can only be applied by administrators
  IF p_force_majeure AND v_actor != 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Force majeure cancellations may only be declared by administrators.';
  END IF;

  -- 6. Idempotency Guard: if already cancelled, return existing state without duplicate writes
  IF v_b.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_cancelled', true,
      'booking_id', v_b.id,
      'status', v_b.status,
      'cancelled_by', v_b.cancelled_by,
      'cancelled_at', v_b.cancelled_at,
      'cancellation_reason', v_b.cancellation_reason,
      'refund_total', v_b.refund_total,
      'deposit_refund_amount', v_b.deposit_refund_amount,
      'fee_refund_amount', v_b.fee_refund_amount,
      'host_refund_amount', v_b.host_refund_amount,
      'host_refund_status', v_b.host_refund_status,
      'host_refund_due_at', v_b.host_refund_due_at,
      'panaw_refund_amount', v_b.panaw_refund_amount,
      'panaw_refund_status', v_b.panaw_refund_status,
      'adjusted_host_payout_amount', v_b.adjusted_host_payout_amount,
      'refund_gcash_number', v_b.refund_gcash_number,
      'message', 'Booking was already cancelled.'
    );
  END IF;

  -- 7. Status transition guard: allow cancellation only from 'pending' or 'accepted'
  IF v_b.status NOT IN ('pending', 'accepted') THEN
    RAISE EXCEPTION 'Cannot cancel booking in % status. Only pending or accepted bookings can be cancelled.', v_b.status;
  END IF;

  -- 8. Payment status guard for tourists: block if deposit is currently uploaded / pending verification
  IF v_actor = 'tourist' AND v_b.payment_status = 'deposit_uploaded' THEN
    RAISE EXCEPTION 'Your deposit is still being verified, please contact support.';
  END IF;

  -- 9. Check-in timeline guard for tourists: past check-in cancellation is disallowed
  v_today_manila := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_days_before := v_b.check_in_date - v_today_manila;

  IF v_actor = 'tourist' AND v_days_before < 0 THEN
    RAISE EXCEPTION 'Cannot cancel booking: Check-in date has already passed.';
  END IF;

  -- 10. Compute exact refund amounts and legs
  SELECT * INTO v_calc
  FROM public.compute_cancellation_refund(p_booking_id, v_actor, p_force_majeure);

  -- 11. GCash number requirement: required ONLY when actor is tourist and refund_total > 0
  IF v_actor = 'tourist' AND v_calc.refund_total > 0.00 THEN
    IF p_refund_gcash_number IS NULL OR p_refund_gcash_number !~ '^09[0-9]{9}$' THEN
      RAISE EXCEPTION 'Invalid GCash Number: A valid 11-digit GCash number starting with 09 is required for refunds (received: %)', coalesce(p_refund_gcash_number, 'NULL');
    END IF;
    v_refund_gcash := p_refund_gcash_number;
  ELSE
    -- Host and admin cancellations store NULL; tourist supplies GCash number later
    -- TODO: In Phase 3, tourist supplies refund GCash number via cancellation receipt / settlement view.
    v_refund_gcash := NULL;
  END IF;

  -- 12. Compute host deadline and statuses
  IF v_calc.host_leg > 0.00 THEN
    v_deadline_hours := coalesce((v_b.cancellation_snapshot->>'host_refund_deadline_hours')::integer, 72);
    v_host_due_at := now() + (v_deadline_hours || ' hours')::interval;
    v_host_status := 'pending';
  ELSE
    v_host_due_at := NULL;
    v_host_status := 'none';
  END IF;

  IF v_calc.panaw_leg > 0.00 THEN
    v_panaw_status := 'pending';
  ELSE
    v_panaw_status := 'none';
  END IF;

  -- 13. Money Rules: adjusted_host_payout_amount calculation
  -- Must be 0.00 when the booking is not paid (payment_status NOT IN ('verified','completed'))
  IF v_b.payment_status NOT IN ('verified', 'completed') THEN
    v_adjusted_host_payout := 0.00;
  ELSE
    -- Let base_deposit = downpayment_amount - convenience_fee
    v_base_deposit := GREATEST(0.00, coalesce(v_b.downpayment_amount, 0.00) - coalesce(v_b.convenience_fee, 0.00));

    -- Let r = deposit_refund / base_deposit (0 if base_deposit = 0; 1 for host cancel / force majeure)
    IF p_force_majeure OR v_actor = 'host' THEN
      v_r := 1.0;
    ELSIF v_base_deposit > 0.00 THEN
      v_r := v_calc.deposit_refund / v_base_deposit;
    ELSE
      v_r := 0.0;
    END IF;

    -- Let payout = deposit_payout_amount; if NULL, use base_deposit - commission_amount
    IF v_b.deposit_payout_amount IS NOT NULL THEN
      v_payout := v_b.deposit_payout_amount;
    ELSE
      v_payout := GREATEST(0.00, v_base_deposit - coalesce(v_b.commission_amount, 0.00));
    END IF;

    -- adjusted_host_payout_amount = payout - round(r * payout, 2) in BOTH cases
    v_adjusted_host_payout := GREATEST(0.00, v_payout - round(v_r * v_payout, 2));
  END IF;

  -- 14. Trim and cap cancellation reason to 500 characters
  v_reason := left(trim(coalesce(p_reason, '')), 500);

  -- 15. Safely cooperate with prevent_booking_financial_tampering trigger:
  -- Save caller's current jwt role claim before setting service_role, and restore immediately after UPDATE
  v_saved_jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  -- 16. Freeze cancellation and financial columns on bookings
  UPDATE public.bookings
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = v_actor,
    cancellation_reason = v_reason,
    refund_total = v_calc.refund_total,
    deposit_refund_amount = v_calc.deposit_refund,
    fee_refund_amount = v_calc.fee_refund,
    host_refund_amount = v_calc.host_leg,
    host_refund_status = v_host_status,
    host_refund_due_at = v_host_due_at,
    panaw_refund_amount = v_calc.panaw_leg,
    panaw_refund_status = v_panaw_status,
    adjusted_host_payout_amount = v_adjusted_host_payout,
    refund_gcash_number = v_refund_gcash
  WHERE id = p_booking_id;

  -- Restore caller's original jwt role claim
  PERFORM set_config('request.jwt.claim.role', v_saved_jwt_role, true);

  -- ---------------------------------------------------------------------------
  -- TODO: Phase 2 Notification & OneSignal Dispatch Events:
  -- 1. Tourist Event: Send cancellation confirmation receipt + refund tracking info.
  -- 2. Host Event: Send cancellation alert. If host_leg > 0, notify host of
  --    host_refund_due_at deadline and required GCash return.
  -- 3. Admin Event: Send cancellation transaction summary for audit and refund queue.
  -- ---------------------------------------------------------------------------

  RETURN jsonb_build_object(
    'success', true,
    'already_cancelled', false,
    'booking_id', p_booking_id,
    'status', 'cancelled',
    'cancelled_by', v_actor,
    'cancelled_at', now(),
    'cancellation_reason', v_reason,
    'tier', v_calc.tier,
    'days_before', v_calc.days_before,
    'refund_total', v_calc.refund_total,
    'deposit_refund_amount', v_calc.deposit_refund,
    'fee_refund_amount', v_calc.fee_refund,
    'host_refund_amount', v_calc.host_leg,
    'host_refund_status', v_host_status,
    'host_refund_due_at', v_host_due_at,
    'panaw_refund_amount', v_calc.panaw_leg,
    'panaw_refund_status', v_panaw_status,
    'adjusted_host_payout_amount', v_adjusted_host_payout,
    'refund_gcash_number', v_refund_gcash,
    'reason', v_calc.reason
  );
END;
$$;

-- Grant execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.cancel_booking_atomic(uuid, text, boolean, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_booking_atomic(uuid, text, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_booking_atomic(uuid, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking_atomic(uuid, text, boolean, text) TO service_role;

COMMIT;
