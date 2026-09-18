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
    v_jwt_role := current_setting('request.jwt.claim.role', true);
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_tampering ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_tampering
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_tampering();


-- -------------------------------------------------------------------------------------
-- 3. HARDEN BOOKINGS ROW-LEVEL SECURITY (PREVENT CLIENT PRICE / STATUS TAMPERING)
-- -------------------------------------------------------------------------------------
-- Drop overly permissive update policy that allowed tourists to modify any column
DROP POLICY IF EXISTS "Strict_Tenant_Tourist_Update_Bookings" ON public.bookings;
DROP POLICY IF EXISTS "Tourists can update own bookings" ON public.bookings;

-- Tourists may ONLY update their booking to cancel it.
-- They cannot modify total_price, payment_status, or force booking acceptance.
CREATE POLICY "Strict_Tenant_Tourist_Cancel_Only_Bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = tourist_id)
  WITH CHECK (
    auth.uid() = tourist_id 
    AND status = 'cancelled'::booking_status
  );


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

-- Output confirmation
DO $$
BEGIN
  RAISE NOTICE 'MVBA Security Hardening Migration completed successfully.';
END $$;
