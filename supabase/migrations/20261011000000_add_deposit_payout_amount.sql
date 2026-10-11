-- ============================================================
-- Phase 1d: Add deposit_payout_amount & update financial trigger
-- ============================================================

-- 1. Add deposit_payout_amount to bookings (additive only, matching numeric type of commission_amount & host_payout_amount)
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS deposit_payout_amount NUMERIC DEFAULT NULL;

-- 2. Update prevent_booking_financial_tampering trigger function
-- ONLY change is adding NEW.deposit_payout_amount IS DISTINCT FROM OLD.deposit_payout_amount to the protected fields
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
  -- Strictly forbid modifying critical financial, verification, and payout columns:
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NEW.payment_status NOT IN ('awaiting_deposit', 'deposit_uploaded') THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can modify payment verification status.';
  END IF;

  IF NEW.payout_status IS DISTINCT FROM OLD.payout_status THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can modify host payout status.';
  END IF;

  IF NEW.total_price IS DISTINCT FROM OLD.total_price OR
     NEW.downpayment_amount IS DISTINCT FROM OLD.downpayment_amount OR
     NEW.commission_amount IS DISTINCT FROM OLD.commission_amount OR
     NEW.host_payout_amount IS DISTINCT FROM OLD.host_payout_amount OR
     NEW.deposit_payout_amount IS DISTINCT FROM OLD.deposit_payout_amount THEN
    RAISE EXCEPTION 'Access Denied: Pricing and commission amounts are immutable.';
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
