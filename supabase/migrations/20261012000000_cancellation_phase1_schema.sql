BEGIN;

-- =============================================================================
-- Migration: 20261012000000_cancellation_phase1_schema.sql
-- Description: Phase 1 Schema additions for Cancellation & Refund system
-- =============================================================================

-- 1. Add cancellation_policy to properties with CHECK constraint
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS cancellation_policy TEXT NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_properties_cancellation_policy'
  ) THEN
    ALTER TABLE public.properties
    ADD CONSTRAINT check_properties_cancellation_policy 
    CHECK (cancellation_policy IN ('flexible', 'standard', 'non_refundable'));
  END IF;
END $$;

-- 2. Add refund configuration columns to system_settings with CHECK constraints
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS refund_full_days INTEGER NOT NULL DEFAULT 7,
ADD COLUMN IF NOT EXISTS refund_partial_days INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS refund_partial_percent NUMERIC NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS convenience_fee_refund_rule TEXT NOT NULL DEFAULT 'never',
ADD COLUMN IF NOT EXISTS host_refund_deadline_hours INTEGER NOT NULL DEFAULT 72;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_system_settings_fee_rule'
  ) THEN
    ALTER TABLE public.system_settings
    ADD CONSTRAINT check_system_settings_fee_rule 
    CHECK (convenience_fee_refund_rule IN ('never', 'full_tier_only', 'always'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_system_settings_partial_percent'
  ) THEN
    ALTER TABLE public.system_settings
    ADD CONSTRAINT check_system_settings_partial_percent 
    CHECK (refund_partial_percent >= 0 AND refund_partial_percent <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_system_settings_days'
  ) THEN
    ALTER TABLE public.system_settings
    ADD CONSTRAINT check_system_settings_days 
    CHECK (refund_partial_days >= 0 AND refund_full_days > refund_partial_days);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_system_settings_deadline'
  ) THEN
    ALTER TABLE public.system_settings
    ADD CONSTRAINT check_system_settings_deadline 
    CHECK (host_refund_deadline_hours >= 1);
  END IF;
END $$;

-- 3. Add cancellation & refund fields to bookings with CHECK constraints
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS cancelled_by TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancellation_policy TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancellation_snapshot JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS policy_accepted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancel_acknowledged_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refund_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS deposit_refund_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS fee_refund_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS adjusted_host_payout_amount NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refund_gcash_number TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS host_refund_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS host_refund_status TEXT NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS host_refund_receipt_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS host_refund_due_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS host_refund_sent_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS panaw_refund_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS panaw_refund_status TEXT NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS panaw_refund_receipt_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS panaw_refund_sent_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refund_issue_reported_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refund_issue_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_bookings_cancellation_policy'
  ) THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT check_bookings_cancellation_policy 
    CHECK (cancellation_policy IS NULL OR cancellation_policy IN ('flexible', 'standard', 'non_refundable'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_bookings_cancelled_by'
  ) THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT check_bookings_cancelled_by 
    CHECK (cancelled_by IS NULL OR cancelled_by IN ('tourist', 'host', 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_bookings_host_refund_status'
  ) THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT check_bookings_host_refund_status 
    CHECK (host_refund_status IN ('none', 'pending', 'sent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_bookings_panaw_refund_status'
  ) THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT check_bookings_panaw_refund_status 
    CHECK (panaw_refund_status IN ('none', 'pending', 'sent'));
  END IF;
END $$;

-- 4. BEFORE INSERT trigger on bookings to snapshot policy & system_settings atomically
CREATE OR REPLACE FUNCTION public.set_booking_cancellation_snapshot()
RETURNS trigger AS $$
DECLARE
  v_prop_policy text;
  v_settings record;
  v_full_days integer := 7;
  v_partial_days integer := 3;
  v_partial_percent numeric := 50;
  v_fee_rule text := 'never';
  v_deadline_hours integer := 72;
BEGIN
  -- 1. Fetch cancellation_policy from property via room_id
  BEGIN
    SELECT coalesce(p.cancellation_policy, 'standard') INTO v_prop_policy
    FROM public.rooms r
    JOIN public.properties p ON p.id = r.property_id
    WHERE r.id = NEW.room_id;
  EXCEPTION WHEN OTHERS THEN
    v_prop_policy := 'standard';
  END;

  NEW.cancellation_policy := coalesce(v_prop_policy, 'standard');

  -- 2. Fetch active system_settings (safely isolated from errors/missing columns)
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

    IF FOUND THEN
      v_full_days := coalesce(v_settings.refund_full_days, 7);
      v_partial_days := coalesce(v_settings.refund_partial_days, 3);
      v_partial_percent := coalesce(v_settings.refund_partial_percent, 50);
      v_fee_rule := coalesce(v_settings.convenience_fee_refund_rule, 'never');
      v_deadline_hours := coalesce(v_settings.host_refund_deadline_hours, 72);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback defaults guarantee insert will NEVER fail
    v_full_days := 7;
    v_partial_days := 3;
    v_partial_percent := 50;
    v_fee_rule := 'never';
    v_deadline_hours := 72;
  END;

  NEW.cancellation_snapshot := jsonb_build_object(
    'policy', NEW.cancellation_policy,
    'refund_full_days', v_full_days,
    'refund_partial_days', v_partial_days,
    'refund_partial_percent', v_partial_percent,
    'convenience_fee_refund_rule', v_fee_rule,
    'host_refund_deadline_hours', v_deadline_hours,
    'snapshotted_at', now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_booking_cancellation_snapshot ON public.bookings;
CREATE TRIGGER trg_set_booking_cancellation_snapshot
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_cancellation_snapshot();

-- 5. Update prevent_booking_financial_tampering trigger function
CREATE OR REPLACE FUNCTION public.prevent_booking_financial_tampering()
RETURNS trigger AS $$
DECLARE
  v_jwt_role text;
  v_caller_role text;
  v_caller_approved boolean;
BEGIN
  -- Allow backend service role (e.g. server actions with service key)
  v_jwt_role := coalesce(current_setting('request.jwt.claim.role', true), (auth.jwt() ->> 'role'));
  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Check if caller is an approved admin
  SELECT role, is_approved INTO v_caller_role, v_caller_approved
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role = 'admin' AND v_caller_approved = true THEN
    RETURN NEW;
  END IF;

  -- For any non-admin / non-service-role caller:
  -- Strictly forbid modifying payment verification status:
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NEW.payment_status NOT IN ('awaiting_deposit', 'deposit_uploaded') THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can modify payment verification status.';
  END IF;

  -- Strictly forbid modifying host payout status:
  IF NEW.payout_status IS DISTINCT FROM OLD.payout_status THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can modify host payout status.';
  END IF;

  -- Strictly forbid modifying core financials, calculations, and cancellation/refund state:
  IF NEW.total_price IS DISTINCT FROM OLD.total_price OR
     NEW.downpayment_amount IS DISTINCT FROM OLD.downpayment_amount OR
     NEW.commission_amount IS DISTINCT FROM OLD.commission_amount OR
     NEW.host_payout_amount IS DISTINCT FROM OLD.host_payout_amount OR
     NEW.deposit_payout_amount IS DISTINCT FROM OLD.deposit_payout_amount OR
     NEW.refund_total IS DISTINCT FROM OLD.refund_total OR
     NEW.deposit_refund_amount IS DISTINCT FROM OLD.deposit_refund_amount OR
     NEW.fee_refund_amount IS DISTINCT FROM OLD.fee_refund_amount OR
     NEW.adjusted_host_payout_amount IS DISTINCT FROM OLD.adjusted_host_payout_amount OR
     NEW.host_refund_amount IS DISTINCT FROM OLD.host_refund_amount OR
     NEW.host_refund_status IS DISTINCT FROM OLD.host_refund_status OR
     NEW.host_refund_receipt_url IS DISTINCT FROM OLD.host_refund_receipt_url OR
     NEW.host_refund_due_at IS DISTINCT FROM OLD.host_refund_due_at OR
     NEW.host_refund_sent_at IS DISTINCT FROM OLD.host_refund_sent_at OR
     NEW.panaw_refund_amount IS DISTINCT FROM OLD.panaw_refund_amount OR
     NEW.panaw_refund_status IS DISTINCT FROM OLD.panaw_refund_status OR
     NEW.panaw_refund_receipt_url IS DISTINCT FROM OLD.panaw_refund_receipt_url OR
     NEW.panaw_refund_sent_at IS DISTINCT FROM OLD.panaw_refund_sent_at OR
     NEW.refunded_at IS DISTINCT FROM OLD.refunded_at OR
     NEW.cancellation_policy IS DISTINCT FROM OLD.cancellation_policy OR
     NEW.cancellation_snapshot IS DISTINCT FROM OLD.cancellation_snapshot OR
     NEW.cancel_acknowledged_at IS DISTINCT FROM OLD.cancel_acknowledged_at OR
     NEW.policy_accepted_at IS DISTINCT FROM OLD.policy_accepted_at OR
     NEW.refund_gcash_number IS DISTINCT FROM OLD.refund_gcash_number OR
     NEW.refund_issue_reported_at IS DISTINCT FROM OLD.refund_issue_reported_at OR
     NEW.refund_issue_reason IS DISTINCT FROM OLD.refund_issue_reason THEN
    RAISE EXCEPTION 'Access Denied: Pricing, commission, and cancellation/refund state are immutable from client.';
  END IF;

  -- Direct status changes to 'cancelled' are forbidden via client (must use cancellation server action/RPC)
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    RAISE EXCEPTION 'Access Denied: Cancellations must be processed via cancellation workflows.';
  END IF;

  -- Hosts may only accept or decline bookings, or update seen_by_host_at
  IF auth.uid() = OLD.owner_id THEN
    IF NEW.tourist_id IS DISTINCT FROM OLD.tourist_id OR
       NEW.room_id IS DISTINCT FROM OLD.room_id OR
       NEW.check_in_date IS DISTINCT FROM OLD.check_in_date OR
       NEW.check_out_date IS DISTINCT FROM OLD.check_out_date THEN
      RAISE EXCEPTION 'Access Denied: Core reservation parameters cannot be altered.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;
