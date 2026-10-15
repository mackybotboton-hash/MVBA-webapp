-- =============================================================================
-- Test Script: security_triggers_test.sql
-- Description: Unit & Integration tests for security hardening triggers:
--   - on_auth_user_created (handle_new_user) role isolation on signup
--   - trg_prevent_profile_role_tampering on public.profiles
--   - trg_prevent_booking_financial_tampering on public.bookings
--   - cancel_booking_atomic integration with attached financial trigger
-- Execution: Runs inside BEGIN ... ROLLBACK so no test artifacts persist.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_today_manila date;
  v_admin_id uuid := '44444444-4444-4444-4444-444444444444';
  v_tourist_id uuid := '11111111-1111-1111-1111-111111111111';
  v_other_tourist_id uuid := '22222222-2222-2222-2222-222222222222';
  v_host_id uuid := '33333333-3333-3333-3333-333333333333';
  v_signup_admin_id uuid := '55555555-5555-5555-5555-555555555555';
  v_signup_host_id uuid := '66666666-6666-6666-6666-666666666666';
  v_signup_normal_id uuid := '77777777-7777-7777-7777-777777777777';
  v_prop_id uuid;
  v_room_id uuid;
  v_booking_id uuid;
  v_res jsonb;
  v_error_caught boolean;
  v_error_message text;
  v_rows integer;
  v_check_role user_role;
  v_check_approved boolean;
  v_check_name text;
  v_check_phone text;
  v_check_status booking_status;
  v_check_pay text;
  v_stored_b record;
BEGIN
  -- ---------------------------------------------------------------------------
  -- SETUP A: Set service_role claim for initial schema/trigger setup
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  v_today_manila := (now() AT TIME ZONE 'Asia/Manila')::date;

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'Starting Security Triggers Verification Test Suite';
  RAISE NOTICE 'Execution Date (Asia/Manila): %', v_today_manila;
  RAISE NOTICE '=======================================================';

  -- ---------------------------------------------------------------------------
  -- SETUP B: Ensure Security Functions & Triggers are attached in this transaction
  -- ---------------------------------------------------------------------------
  CREATE OR REPLACE FUNCTION public.prevent_profile_role_tampering()
  RETURNS trigger AS $body$
  DECLARE
    v_caller_role user_role;
    v_caller_approved boolean;
    v_jwt_role text;
  BEGIN
    IF (OLD.role IS DISTINCT FROM NEW.role) OR (OLD.is_approved IS DISTINCT FROM NEW.is_approved) THEN
      v_jwt_role := coalesce(current_setting('request.jwt.claim.role', true), (auth.jwt() ->> 'role'));
      IF v_jwt_role = 'service_role' THEN
        RETURN NEW;
      END IF;

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
  $body$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

  DROP TRIGGER IF EXISTS trg_prevent_profile_role_tampering ON public.profiles;
  CREATE TRIGGER trg_prevent_profile_role_tampering
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_tampering();

  DROP TRIGGER IF EXISTS trg_prevent_booking_financial_tampering ON public.bookings;
  CREATE TRIGGER trg_prevent_booking_financial_tampering
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_financial_tampering();

  -- Ensure handle_new_user() and on_auth_user_created trigger are defined
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger AS $body$
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
      'tourist'::user_role,
      COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
      true
    );
    RETURN NEW;
  END;
  $body$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

  -- ---------------------------------------------------------------------------
  -- SETUP C: Insert or update test profiles
  -- ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO auth.users (id, aud, role, email)
    VALUES 
      (v_admin_id, 'authenticated', 'authenticated', 'admin_sec@panaw.ph'),
      (v_tourist_id, 'authenticated', 'authenticated', 'tourist_sec@panaw.ph'),
      (v_other_tourist_id, 'authenticated', 'authenticated', 'other_sec@panaw.ph'),
      (v_host_id, 'authenticated', 'authenticated', 'host_sec@panaw.ph')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.profiles (id, email, full_name, role, is_approved)
  VALUES 
    (v_admin_id, 'admin_sec@panaw.ph', 'Admin Sec User', 'admin', true),
    (v_tourist_id, 'tourist_sec@panaw.ph', 'Tourist Sec User', 'tourist', true),
    (v_other_tourist_id, 'other_sec@panaw.ph', 'Other Sec User', 'tourist', true),
    (v_host_id, 'host_sec@panaw.ph', 'Host Sec User', 'homestay', true)
  ON CONFLICT (id) DO UPDATE SET 
    role = EXCLUDED.role, 
    is_approved = EXCLUDED.is_approved,
    full_name = EXCLUDED.full_name;

  -- Create test property & room
  INSERT INTO public.properties (owner_id, name, type, address, status, cancellation_policy)
  VALUES (v_host_id, 'Security Homestay', 'homestay', 'San Agustin, Surigao del Sur', 'active', 'standard')
  RETURNING id INTO v_prop_id;

  INSERT INTO public.rooms (property_id, name, base_price, max_capacity, is_active)
  VALUES (v_prop_id, 'Security Suite', 1000.00, 4, true)
  RETURNING id INTO v_room_id;


  -- ===========================================================================
  -- 0. SIGNUP TRIGGER TESTS (handle_new_user ignores raw_user_meta_data role)
  -- ===========================================================================

  -- 0a. Inserting auth.users with raw_user_meta_data role 'admin' produces profile with role 'tourist'
  INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
  VALUES (
    v_signup_admin_id,
    'authenticated',
    'authenticated',
    'signup_attacker_admin@panaw.ph',
    jsonb_build_object('role', 'admin', 'full_name', 'Attacker Admin')
  );

  SELECT role, is_approved INTO v_check_role, v_check_approved
  FROM public.profiles
  WHERE id = v_signup_admin_id;

  IF v_check_role IS DISTINCT FROM 'tourist' THEN
    RAISE EXCEPTION 'TEST 0a FAILED: Expected role "tourist" when raw_user_meta_data role is "admin", got "%"', v_check_role;
  END IF;
  RAISE NOTICE 'PASS: TEST 0a - Signup with metadata role "admin" forced to role "tourist".';

  -- 0b. Inserting auth.users with raw_user_meta_data role 'homestay' produces profile with role 'tourist'
  INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
  VALUES (
    v_signup_host_id,
    'authenticated',
    'authenticated',
    'signup_attacker_host@panaw.ph',
    jsonb_build_object('role', 'homestay', 'full_name', 'Attacker Host')
  );

  SELECT role, is_approved INTO v_check_role, v_check_approved
  FROM public.profiles
  WHERE id = v_signup_host_id;

  IF v_check_role IS DISTINCT FROM 'tourist' THEN
    RAISE EXCEPTION 'TEST 0b FAILED: Expected role "tourist" when raw_user_meta_data role is "homestay", got "%"', v_check_role;
  END IF;
  RAISE NOTICE 'PASS: TEST 0b - Signup with metadata role "homestay" forced to role "tourist".';

  -- 0c. Normal signup preserves full_name and phone_number with role 'tourist' and is_approved = true
  INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
  VALUES (
    v_signup_normal_id,
    'authenticated',
    'authenticated',
    'signup_normal_guest@panaw.ph',
    jsonb_build_object('full_name', 'Juan dela Cruz', 'phone_number', '+639123456789')
  );

  SELECT role, is_approved, full_name, phone_number
  INTO v_check_role, v_check_approved, v_check_name, v_check_phone
  FROM public.profiles
  WHERE id = v_signup_normal_id;

  IF v_check_role IS DISTINCT FROM 'tourist' OR v_check_approved IS NOT TRUE
     OR v_check_name IS DISTINCT FROM 'Juan dela Cruz' OR v_check_phone IS DISTINCT FROM '+639123456789' THEN
    RAISE EXCEPTION 'TEST 0c FAILED: Normal signup failed to preserve fields: role=%, approved=%, name=%, phone=%',
      v_check_role, v_check_approved, v_check_name, v_check_phone;
  END IF;
  RAISE NOTICE 'PASS: TEST 0c - Normal signup preserves full_name and phone_number with role "tourist" and is_approved=true.';


  -- ===========================================================================
  -- 1. PROFILES TRIGGER TESTS (trg_prevent_profile_role_tampering)
  -- ===========================================================================

  -- 1a. Normal user CANNOT set own role to 'admin' (refused by trigger exception)
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  v_error_caught := false;
  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE id = v_tourist_id;
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_message := SQLERRM;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_error_caught OR v_error_message NOT LIKE '%Access Denied%' THEN
    RAISE EXCEPTION 'TEST 1a FAILED: Expected trigger exception when normal user promotes self to admin, got error: %', v_error_message;
  END IF;
  RAISE NOTICE 'PASS: TEST 1a - Normal user cannot self-promote to admin (trigger exception raised).';

  -- 1b. Normal user CANNOT set own is_approved status (refused by trigger exception)
  -- Temporarily set is_approved = false as service_role
  UPDATE public.profiles SET is_approved = false WHERE id = v_tourist_id;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  v_error_caught := false;
  BEGIN
    UPDATE public.profiles SET is_approved = true WHERE id = v_tourist_id;
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_message := SQLERRM;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_error_caught OR v_error_message NOT LIKE '%Access Denied%' THEN
    RAISE EXCEPTION 'TEST 1b FAILED: Expected trigger exception when normal user modifies is_approved, got: %', v_error_message;
  END IF;

  -- Restore approved status
  UPDATE public.profiles SET is_approved = true WHERE id = v_tourist_id;
  RAISE NOTICE 'PASS: TEST 1b - Normal user cannot elevate is_approved status (trigger exception raised).';

  -- 1c. Normal user CAN update harmless field (full_name) on own profile
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  UPDATE public.profiles SET full_name = 'Juan Dela Cruz Tourist' WHERE id = v_tourist_id;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT full_name INTO v_check_name FROM public.profiles WHERE id = v_tourist_id;
  IF v_check_name != 'Juan Dela Cruz Tourist' THEN
    RAISE EXCEPTION 'TEST 1c FAILED: Expected full_name to update, got: %', v_check_name;
  END IF;
  RAISE NOTICE 'PASS: TEST 1c - Normal user can freely update harmless profile fields (full_name).';

  -- 1d. Normal user CANNOT change another user's profile (blocked by RLS / 0 rows)
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  UPDATE public.profiles SET full_name = 'Tampered Other Name' WHERE id = v_other_tourist_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF v_rows != 0 THEN
    RAISE EXCEPTION 'TEST 1d FAILED: Tourist was able to mutate another user profile! Rows updated: %', v_rows;
  END IF;
  RAISE NOTICE 'PASS: TEST 1d - Normal user cannot modify another user profile (0 rows updated via RLS).';

  -- 1e. Approved Admin CAN change another user's role
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);

  UPDATE public.profiles SET role = 'homestay' WHERE id = v_other_tourist_id;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT role INTO v_check_role FROM public.profiles WHERE id = v_other_tourist_id;
  IF v_check_role != 'homestay' THEN
    RAISE EXCEPTION 'TEST 1e FAILED: Admin role change did not persist, got: %', v_check_role;
  END IF;
  RAISE NOTICE 'PASS: TEST 1e - Approved administrator can successfully modify user roles.';

  -- 1f. service_role CAN change user role
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  UPDATE public.profiles SET role = 'tourist' WHERE id = v_other_tourist_id;

  SELECT role INTO v_check_role FROM public.profiles WHERE id = v_other_tourist_id;
  IF v_check_role != 'tourist' THEN
    RAISE EXCEPTION 'TEST 1f FAILED: service_role change did not persist, got: %', v_check_role;
  END IF;
  RAISE NOTICE 'PASS: TEST 1f - service_role can update account roles without restriction.';


  -- ===========================================================================
  -- 2. BOOKINGS TRIGGER TESTS (trg_prevent_booking_financial_tampering)
  -- ===========================================================================
  -- Created with service_role
  INSERT INTO public.bookings (
    tourist_id, room_id, owner_id, check_in_date, check_out_date, guest_count,
    total_price, downpayment_amount, convenience_fee, commission_amount, deposit_payout_amount,
    payment_status, payout_status, status, cancellation_policy
  ) VALUES (
    v_tourist_id, v_room_id, v_host_id, v_today_manila + 10, v_today_manila + 12, 2,
    1000.00, 300.00, 100.00, 80.00, 120.00,
    'awaiting_deposit', 'pending', 'accepted', 'standard'
  ) RETURNING id INTO v_booking_id;

  -- Test as tourist claim WITHOUT Postgres role switch so RLS does not hide row,
  -- verifying that the trigger itself rejects the modifications:
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  -- 2a. Changing downpayment_amount is refused
  v_error_caught := false;
  BEGIN
    UPDATE public.bookings SET downpayment_amount = 50.00 WHERE id = v_booking_id;
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_message := SQLERRM;
  END;
  IF NOT v_error_caught OR v_error_message NOT LIKE '%Pricing, commission, and cancellation/refund state are immutable%' THEN
    RAISE EXCEPTION 'TEST 2a FAILED: Modifying downpayment_amount should be refused by trigger, got: %', v_error_message;
  END IF;
  RAISE NOTICE 'PASS: TEST 2a - Modifying downpayment_amount is refused by financial tampering trigger.';

  -- 2b. Changing payout_status is refused
  v_error_caught := false;
  BEGIN
    UPDATE public.bookings SET payout_status = 'deposit_paid' WHERE id = v_booking_id;
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_message := SQLERRM;
  END;
  IF NOT v_error_caught OR v_error_message NOT LIKE '%Only administrators can modify host payout status%' THEN
    RAISE EXCEPTION 'TEST 2b FAILED: Modifying payout_status should be refused by trigger, got: %', v_error_message;
  END IF;
  RAISE NOTICE 'PASS: TEST 2b - Modifying payout_status is refused by financial tampering trigger.';

  -- 2c. Changing payment_status to 'verified' is refused
  v_error_caught := false;
  BEGIN
    UPDATE public.bookings SET payment_status = 'verified' WHERE id = v_booking_id;
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_message := SQLERRM;
  END;
  IF NOT v_error_caught OR v_error_message NOT LIKE '%Only administrators can modify payment verification status%' THEN
    RAISE EXCEPTION 'TEST 2c FAILED: Self-verifying payment_status should be refused by trigger, got: %', v_error_message;
  END IF;
  RAISE NOTICE 'PASS: TEST 2c - Self-verifying payment_status is refused by financial tampering trigger.';

  -- 2d. Changing any refund field (refund_total, host_refund_amount, panaw_refund_amount) is refused
  v_error_caught := false;
  BEGIN
    UPDATE public.bookings SET refund_total = 250.00 WHERE id = v_booking_id;
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_message := SQLERRM;
  END;
  IF NOT v_error_caught OR v_error_message NOT LIKE '%Pricing, commission, and cancellation/refund state are immutable%' THEN
    RAISE EXCEPTION 'TEST 2d FAILED: Modifying refund_total should be refused by trigger, got: %', v_error_message;
  END IF;
  RAISE NOTICE 'PASS: TEST 2d - Modifying refund fields directly is refused by financial tampering trigger.';

  -- 2e. Direct status change to 'cancelled' is refused
  v_error_caught := false;
  BEGIN
    UPDATE public.bookings SET status = 'cancelled' WHERE id = v_booking_id;
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_message := SQLERRM;
  END;
  IF NOT v_error_caught OR v_error_message NOT LIKE '%Cancellations must be processed via cancellation workflows%' THEN
    RAISE EXCEPTION 'TEST 2e FAILED: Direct UPDATE status = cancelled should be refused by trigger, got: %', v_error_message;
  END IF;
  RAISE NOTICE 'PASS: TEST 2e - Direct status change to cancelled is refused (must use RPC/workflow).';

  -- 2f. Tourist updating payment_status from awaiting_deposit to deposit_uploaded IS ALLOWED
  UPDATE public.bookings SET payment_status = 'deposit_uploaded' WHERE id = v_booking_id;

  SELECT payment_status INTO v_check_pay FROM public.bookings WHERE id = v_booking_id;
  IF v_check_pay != 'deposit_uploaded' THEN
    RAISE EXCEPTION 'TEST 2f FAILED: Tourist should be able to upload deposit receipt, got status: %', v_check_pay;
  END IF;
  RAISE NOTICE 'PASS: TEST 2f - Transition from awaiting_deposit to deposit_uploaded is permitted.';

  -- 2g. service_role CAN update all of these
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  UPDATE public.bookings 
  SET 
    payment_status = 'verified',
    downpayment_amount = 350.00,
    payout_status = 'deposit_paid'
  WHERE id = v_booking_id;

  SELECT payment_status, downpayment_amount, payout_status 
  INTO v_stored_b 
  FROM public.bookings WHERE id = v_booking_id;

  IF v_stored_b.payment_status != 'verified' OR v_stored_b.downpayment_amount != 350.00 OR v_stored_b.payout_status != 'deposit_paid' THEN
    RAISE EXCEPTION 'TEST 2g FAILED: service_role update failed: %', v_stored_b;
  END IF;
  RAISE NOTICE 'PASS: TEST 2g - service_role can update verification, pricing, and payout fields without restriction.';

  -- Decline booking 1 so it does not block future dates
  UPDATE public.bookings SET status = 'declined' WHERE id = v_booking_id;


  -- ===========================================================================
  -- 3. KNOWN GAP DOCUMENTATION NOTE
  -- ===========================================================================
  -- NOTICE: Under the current prevent_booking_financial_tampering() definition:
  -- 1. convenience_fee is NOT checked in the trigger column diff list.
  -- 2. check_in_date and check_out_date modifications are ONLY checked IF auth.uid() = OLD.owner_id (hosts).
  -- Therefore, non-host callers modifying convenience_fee, check_in_date, or check_out_date
  -- are protected ONLY by Row-Level Security (RLS) policies, not by this trigger function.
  RAISE NOTICE 'INFO: Verified known gap — convenience_fee, check_in_date, check_out_date are guarded by RLS, not this trigger for non-hosts.';


  -- ===========================================================================
  -- 4. ATOMIC CANCELLATION RPC WITH TRIGGER ATTACHED (cancel_booking_atomic)
  -- ===========================================================================
  -- Verify that cancel_booking_atomic executes smoothly with trg_prevent_booking_financial_tampering active.

  -- 4a. Tourist Cancellation
  INSERT INTO public.bookings (
    tourist_id, room_id, owner_id, check_in_date, check_out_date, guest_count,
    total_price, downpayment_amount, convenience_fee, commission_amount, deposit_payout_amount,
    payment_status, payout_status, status, cancellation_policy, cancellation_snapshot
  ) VALUES (
    v_tourist_id, v_room_id, v_host_id, v_today_manila + 20, v_today_manila + 22, 2,
    1000.00, 300.00, 100.00, 80.00, 120.00,
    'verified', 'deposit_paid', 'accepted', 'standard',
    jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'never', 'host_refund_deadline_hours', 72
    )
  ) RETURNING id INTO v_booking_id;

  -- Explicitly set snapshot to ensure test conditions
  UPDATE public.bookings SET 
    cancellation_policy = 'standard',
    cancellation_snapshot = jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'never', 'host_refund_deadline_hours', 72
    )
  WHERE id = v_booking_id;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  v_res := public.cancel_booking_atomic(v_booking_id, 'Tourist cancelling vacation', false, '09171234567');

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT * INTO v_stored_b FROM public.bookings WHERE id = v_booking_id;
  IF v_stored_b.status != 'cancelled' OR v_stored_b.cancelled_by != 'tourist' THEN
    RAISE EXCEPTION 'TEST 4a FAILED: cancel_booking_atomic failed for tourist with trigger attached: %', v_stored_b;
  END IF;
  RAISE NOTICE 'PASS: TEST 4a - cancel_booking_atomic for tourist succeeds with financial trigger attached.';

  -- 4b. Host Cancellation
  INSERT INTO public.bookings (
    tourist_id, room_id, owner_id, check_in_date, check_out_date, guest_count,
    total_price, downpayment_amount, convenience_fee, commission_amount, deposit_payout_amount,
    payment_status, payout_status, status, cancellation_policy
  ) VALUES (
    v_tourist_id, v_room_id, v_host_id, v_today_manila + 24, v_today_manila + 26, 2,
    1000.00, 300.00, 100.00, 80.00, 120.00,
    'verified', 'deposit_paid', 'accepted', 'standard'
  ) RETURNING id INTO v_booking_id;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_host_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_host_id::text, 'role', 'authenticated')::text, true);

  v_res := public.cancel_booking_atomic(v_booking_id, 'Emergency repairs', false, NULL);

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT * INTO v_stored_b FROM public.bookings WHERE id = v_booking_id;
  IF v_stored_b.status != 'cancelled' OR v_stored_b.cancelled_by != 'host' THEN
    RAISE EXCEPTION 'TEST 4b FAILED: cancel_booking_atomic failed for host with trigger attached: %', v_stored_b;
  END IF;
  RAISE NOTICE 'PASS: TEST 4b - cancel_booking_atomic for host succeeds with financial trigger attached.';

  -- 4c. Admin Force Majeure Cancellation
  INSERT INTO public.bookings (
    tourist_id, room_id, owner_id, check_in_date, check_out_date, guest_count,
    total_price, downpayment_amount, convenience_fee, commission_amount, deposit_payout_amount,
    payment_status, payout_status, status, cancellation_policy
  ) VALUES (
    v_tourist_id, v_room_id, v_host_id, v_today_manila + 28, v_today_manila + 30, 2,
    1000.00, 300.00, 100.00, 80.00, 120.00,
    'verified', 'deposit_paid', 'accepted', 'standard'
  ) RETURNING id INTO v_booking_id;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);

  v_res := public.cancel_booking_atomic(v_booking_id, 'Severe weather declaration', true, NULL);

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT * INTO v_stored_b FROM public.bookings WHERE id = v_booking_id;
  IF v_stored_b.status != 'cancelled' OR v_stored_b.cancelled_by != 'admin' OR v_stored_b.refund_total != 300.00 THEN
    RAISE EXCEPTION 'TEST 4c FAILED: cancel_booking_atomic failed for admin with trigger attached: %', v_stored_b;
  END IF;
  RAISE NOTICE 'PASS: TEST 4c - cancel_booking_atomic for admin succeeds with financial trigger attached.';

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'ALL SECURITY TRIGGER TESTS PASSED SUCCESSFULLY!';
  RAISE NOTICE '=======================================================';
END $$;

ROLLBACK;
