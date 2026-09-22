-- =====================================================================================
-- MVBA PWA: Comprehensive Security Hardening & Zero-Trust Authorization Migration
-- INSTRUCTIONS FOR PROJECT LEADER / DATABASE ADMINISTRATOR:
-- Copy and run this script in the Supabase SQL Editor to enforce database-level security.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 1. HARDEN USER SIGNUP TRIGGER (PREVENT SELF-ROLE ASSIGNMENT VIA CLIENT METADATA)
-- -------------------------------------------------------------------------------------
-- Public signups must ALWAYS default to 'tourist' with auto-approval.
-- Administrative, Homestay, and Resort owner accounts must only be provisioned
-- by approved administrators via secure Server Actions / Service Role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    phone_number,
    is_approved
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'tourist'::user_role, -- Enforced default: ignores client-supplied role
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    true                  -- Tourists are auto-approved
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-bind trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- -------------------------------------------------------------------------------------
-- 2. PREVENT PRIVILEGE ESCALATION ON PROFILES TABLE (BEFORE UPDATE TRIGGER)
-- -------------------------------------------------------------------------------------
-- Prevents authenticated users from updating their own 'role' or 'is_approved' status.
-- Only an approved administrator or the service_role can elevate permissions.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_tampering()
RETURNS trigger AS $$
DECLARE
  v_caller_role user_role;
  v_caller_approved boolean;
  v_jwt_role text;
BEGIN
  -- Check if privileged fields are being modified
  IF (OLD.role IS DISTINCT FROM NEW.role) OR (OLD.is_approved IS DISTINCT FROM NEW.is_approved) THEN
    
    -- Allow Service Role key (used in secure server actions)
    v_jwt_role := coalesce(current_setting('request.jwt.claim.role', true), (auth.jwt() ->> 'role'));
    IF v_jwt_role = 'service_role' THEN
      RETURN NEW;
    END IF;

    -- Verify if caller is an approved admin in profiles
    SELECT role, is_approved INTO v_caller_role, v_caller_approved
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_caller_role = 'admin' AND v_caller_approved = true THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Access Denied: You do not have permission to modify account roles or approval status.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_tampering ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_tampering
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_tampering();


-- -------------------------------------------------------------------------------------
-- 3. HARDEN BOOKINGS ROW-LEVEL SECURITY & FINANCIAL INTEGRITY
-- -------------------------------------------------------------------------------------
-- Drop overly permissive update policy that allowed tourists to modify any column
DROP POLICY IF EXISTS "Strict_Tenant_Tourist_Update_Bookings" ON public.bookings;
DROP POLICY IF EXISTS "Tourists can update own bookings" ON public.bookings;

-- Tourists may ONLY update their booking to cancel it.
CREATE POLICY "Strict_Tenant_Tourist_Cancel_Only_Bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = tourist_id)
  WITH CHECK (
    auth.uid() = tourist_id 
    AND status = 'cancelled'::booking_status
  );

-- Database Trigger: Prevent unauthorized tampering of prices, deposits, commissions, and payouts
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
     NEW.host_payout_amount IS DISTINCT FROM OLD.host_payout_amount THEN
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

DROP TRIGGER IF EXISTS trg_prevent_booking_financial_tampering ON public.bookings;
CREATE TRIGGER trg_prevent_booking_financial_tampering
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_financial_tampering();


-- -------------------------------------------------------------------------------------
-- 4. HARDEN ASSOCIATION DUES (PREVENT HOSTS FROM SELF-MARKING DUES AS PAID)
-- -------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Strict_Tenant_Owner_Update_Dues" ON public.association_dues;
DROP POLICY IF EXISTS "Owners can update own dues" ON public.association_dues;

-- Owners may update their dues row ONLY to upload proof of payment (receipt_url).
-- They cannot change status to 'paid' (only admins can verify and mark as paid).
CREATE POLICY "Strict_Tenant_Owner_Upload_Dues_Receipt"
  ON public.association_dues FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (
    auth.uid() = owner_id 
    AND status != 'paid'::dues_status
  );


-- -------------------------------------------------------------------------------------
-- 5. STORAGE RLS: ALLOW PROPERTY HOSTS TO VIEW GUEST PAYMENT RECEIPTS
-- -------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owner and admin read receipts" ON storage.objects;

-- Allows:
-- 1. The uploader to view their own uploaded receipt.
-- 2. Association admins to audit receipts.
-- 3. Property hosts to view receipts for bookings made on their rooms.
CREATE POLICY "Secure_Receipt_Access_Uploader_Host_Admin"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-receipts' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin' AND is_approved = true
      )
      OR EXISTS (
        SELECT 1 FROM public.bookings b
        JOIN public.rooms r ON r.id = b.room_id
        JOIN public.properties p ON p.id = r.property_id
        WHERE p.owner_id = auth.uid()
          AND b.receipt_url LIKE '%' || name || '%'
      )
    )
  );


-- -------------------------------------------------------------------------------------
-- 6. HARDEN CHAT MESSAGES (IMMUTABLE CONTENT & SENDER INTEGRITY)
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_message_tampering()
RETURNS trigger AS $$
DECLARE
  v_jwt_role text;
BEGIN
  v_jwt_role := coalesce(current_setting('request.jwt.claim.role', true), (auth.jwt() ->> 'role'));
  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Message content, sender, receiver, and timestamp can NEVER be altered once sent
  IF NEW.content IS DISTINCT FROM OLD.content OR
     NEW.sender_id IS DISTINCT FROM OLD.sender_id OR
     NEW.receiver_id IS DISTINCT FROM OLD.receiver_id OR
     NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Access Denied: Message history is immutable.';
  END IF;

  -- Only receiver can update is_read
  IF NEW.is_read IS DISTINCT FROM OLD.is_read AND auth.uid() != OLD.receiver_id THEN
    RAISE EXCEPTION 'Access Denied: Only the recipient can mark a message as read.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_message_tampering ON public.messages;
CREATE TRIGGER trg_prevent_message_tampering
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.prevent_message_tampering();


-- Output confirmation
DO $$
BEGIN
  RAISE NOTICE 'MVBA Security Hardening Migration completed successfully.';
END $$;
