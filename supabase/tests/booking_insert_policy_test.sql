-- =============================================================================
-- Test Script: booking_insert_policy_test.sql
-- Description: Unit & Integration tests for closing direct booking INSERT hole:
--   PRECONDITION: Verify all overloads of request_booking_atomic_v2 block anon + authenticated.
--   TEST 1:  Direct INSERT into bookings as authenticated tourist is refused by RLS.
--   TEST 2a: Tourist calling request_booking_atomic_v2 is refused (42501).
--   TEST 2b: service_role calling request_booking_atomic_v2 succeeds ('pending', 'awaiting_deposit').
--   TEST 2c: Anon calling request_booking_atomic_v2 is refused (42501).
--   TEST 3:  Direct INSERT into bookings as anon is refused by RLS.
-- NOTE: This script does NOT modify any permissions. It tests the live DB state.
-- Execution: Runs inside BEGIN ... ROLLBACK so no test artifacts persist.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_today_manila date;
  v_tourist_id uuid := '11111111-1111-1111-1111-111111111111';
  v_host_id uuid := '33333333-3333-3333-3333-333333333333';
  v_prop_id uuid;
  v_room_id uuid;
  v_booking_id uuid;
  v_error_caught boolean;
  v_error_code text;
  v_error_message text;
  v_res jsonb;
  v_stored_b record;
  v_proc_rec record;
  v_fn_oid oid;
  v_fn_sig text;
  v_anon_ok boolean;
  v_auth_ok boolean;
  v_svc_ok boolean;
BEGIN
  -- ---------------------------------------------------------------------------
  -- SETUP A: Set service_role claim for initial schema/trigger setup
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  v_today_manila := (now() AT TIME ZONE 'Asia/Manila')::date;

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'Starting Booking Direct INSERT Policy Test Suite';
  RAISE NOTICE 'Execution Date (Asia/Manila): %', v_today_manila;
  RAISE NOTICE '=======================================================';

  -- ---------------------------------------------------------------------------
  -- SETUP B: Apply migration policy drops idempotently in transaction
  -- ---------------------------------------------------------------------------
  DROP POLICY IF EXISTS "Tourists can create bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Strict_Tenant_Tourist_Insert_Bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Users can insert own bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.bookings;

  -- Ensure RLS is enabled on public.bookings
  ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

  -- ---------------------------------------------------------------------------
  -- PRECONDITION: Verify every overload of request_booking_atomic_v2 blocks
  -- anon and authenticated, and allows service_role. This test does NOT modify
  -- permissions; it asserts the live state that the migration must enforce.
  -- ---------------------------------------------------------------------------
  FOR v_proc_rec IN (
    SELECT p.oid AS fn_oid, p.oid::regprocedure AS fn_sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'request_booking_atomic_v2'
  ) LOOP
    v_fn_oid  := v_proc_rec.fn_oid;
    v_fn_sig  := v_proc_rec.fn_sig::text;
    v_anon_ok := has_function_privilege('anon',          v_fn_oid, 'EXECUTE');
    v_auth_ok := has_function_privilege('authenticated', v_fn_oid, 'EXECUTE');
    v_svc_ok  := has_function_privilege('service_role',  v_fn_oid, 'EXECUTE');

    IF v_anon_ok THEN
      RAISE EXCEPTION 'PRECONDITION FAILED: anon has EXECUTE on %. Run DROP FUNCTION for the stale overload and re-apply permissions.', v_fn_sig;
    END IF;
    IF v_auth_ok THEN
      RAISE EXCEPTION 'PRECONDITION FAILED: authenticated has EXECUTE on %. Re-apply permissions.', v_fn_sig;
    END IF;
    IF NOT v_svc_ok THEN
      RAISE EXCEPTION 'PRECONDITION FAILED: service_role does NOT have EXECUTE on %. Re-apply permissions.', v_fn_sig;
    END IF;
    RAISE NOTICE 'PRECONDITION PASS: % → anon=%, authenticated=%, service_role=%',
      v_fn_sig, v_anon_ok, v_auth_ok, v_svc_ok;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- SETUP C: Test Users, Profiles, Property, Room
  -- ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO auth.users (id, aud, role, email)
    VALUES 
      (v_tourist_id, 'authenticated', 'authenticated', 'tourist_insert_test@panaw.ph'),
      (v_host_id, 'authenticated', 'authenticated', 'host_insert_test@panaw.ph')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.profiles (id, email, full_name, role, is_approved)
  VALUES 
    (v_tourist_id, 'tourist_insert_test@panaw.ph', 'Tourist Insert Tester', 'tourist', true),
    (v_host_id, 'host_insert_test@panaw.ph', 'Host Insert Tester', 'homestay', true)
  ON CONFLICT (id) DO UPDATE SET 
    role = EXCLUDED.role, 
    is_approved = EXCLUDED.is_approved,
    full_name = EXCLUDED.full_name;

  INSERT INTO public.properties (owner_id, name, type, address, status, cancellation_policy)
  VALUES (v_host_id, 'Direct Insert Test Homestay', 'homestay', 'San Agustin, Surigao del Sur', 'active', 'standard')
  RETURNING id INTO v_prop_id;

  INSERT INTO public.rooms (property_id, name, base_price, max_capacity, is_active)
  VALUES (v_prop_id, 'Direct Insert Suite', 1000.00, 4, true)
  RETURNING id INTO v_room_id;


  -- ===========================================================================
  -- TEST 1: Direct INSERT into bookings as authenticated tourist is REFUSED
  -- ===========================================================================
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  v_error_caught := false;
  v_error_code := '';
  v_error_message := '';
  BEGIN
    INSERT INTO public.bookings (
      tourist_id, room_id, check_in_date, check_out_date,
      guest_count, total_price, downpayment_amount, commission_amount,
      convenience_fee, payment_status, status
    ) VALUES (
      v_tourist_id, v_room_id, v_today_manila + 5, v_today_manila + 7,
      2, 1000.00, 10.00, 1.00,
      0.00, 'verified', 'accepted'
    );
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_code := SQLSTATE;
    v_error_message := SQLERRM;
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Direct INSERT by authenticated tourist was NOT rejected by RLS!';
  END IF;
  RAISE NOTICE 'PASS: TEST 1 - Direct INSERT by authenticated tourist refused by RLS (SQLSTATE: %, Error: %).',
    v_error_code, v_error_message;


  -- ===========================================================================
  -- TEST 2a: Tourist calling request_booking_atomic_v2 is REFUSED (42501)
  -- ===========================================================================
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  v_error_caught := false;
  v_error_code := '';
  v_error_message := '';
  BEGIN
    v_res := public.request_booking_atomic_v2(
      p_tourist_id := v_tourist_id,
      p_room_id := v_room_id,
      p_check_in := v_today_manila + 10,
      p_check_out := v_today_manila + 12,
      p_guest_count := 2,
      p_total_price := 2000.00,
      p_downpayment_amount := 500.00,
      p_downpayment_percent := 25,
      p_commission_amount := 160.00,
      p_host_payout_amount := 1840.00,
      p_convenience_fee := 100.00,
      p_notes := 'Tourist direct RPC call attempt'
    );
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_code := SQLSTATE;
    v_error_message := SQLERRM;
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 2a FAILED: Tourist was able to execute request_booking_atomic_v2!';
  END IF;
  IF v_error_code != '42501' AND v_error_message NOT LIKE '%permission denied%' THEN
    RAISE EXCEPTION 'TEST 2a FAILED: Expected permission denied (42501), got [%: %]', v_error_code, v_error_message;
  END IF;
  RAISE NOTICE 'PASS: TEST 2a - Tourist calling request_booking_atomic_v2 refused with permission error (SQLSTATE: %, Error: %).',
    v_error_code, v_error_message;


  -- ===========================================================================
  -- TEST 2b: Same call as service_role SUCCEEDS ('pending', 'awaiting_deposit')
  -- ===========================================================================
  EXECUTE 'RESET ROLE';
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);

  v_res := public.request_booking_atomic_v2(
    p_tourist_id := v_tourist_id,
    p_room_id := v_room_id,
    p_check_in := v_today_manila + 10,
    p_check_out := v_today_manila + 12,
    p_guest_count := 2,
    p_total_price := 2000.00,
    p_downpayment_amount := 500.00,
    p_downpayment_percent := 25,
    p_commission_amount := 160.00,
    p_host_payout_amount := 1840.00,
    p_convenience_fee := 100.00,
    p_notes := 'Atomic RPC booking via service_role'
  );

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 2b FAILED: request_booking_atomic_v2 as service_role returned failure: %', v_res;
  END IF;

  v_booking_id := (v_res->>'booking_id')::uuid;
  SELECT * INTO v_stored_b FROM public.bookings WHERE id = v_booking_id;

  IF v_stored_b.id IS NULL OR v_stored_b.tourist_id != v_tourist_id 
     OR v_stored_b.status != 'pending' OR v_stored_b.payment_status != 'awaiting_deposit' THEN
    RAISE EXCEPTION 'TEST 2b FAILED: Booking created via service_role RPC has unexpected state: %', to_jsonb(v_stored_b);
  END IF;
  RAISE NOTICE 'PASS: TEST 2b - request_booking_atomic_v2 as service_role succeeded (booking_id: %, status: %, payment_status: %).',
    v_booking_id, v_stored_b.status, v_stored_b.payment_status;


  -- ===========================================================================
  -- TEST 2c: Anon calling request_booking_atomic_v2 is REFUSED (42501)
  -- ===========================================================================
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);

  v_error_caught := false;
  v_error_code := '';
  v_error_message := '';
  BEGIN
    v_res := public.request_booking_atomic_v2(
      p_tourist_id := v_tourist_id,
      p_room_id := v_room_id,
      p_check_in := v_today_manila + 20,
      p_check_out := v_today_manila + 22,
      p_guest_count := 2,
      p_total_price := 2000.00,
      p_downpayment_amount := 500.00,
      p_downpayment_percent := 25,
      p_commission_amount := 160.00,
      p_host_payout_amount := 1840.00,
      p_convenience_fee := 100.00,
      p_notes := 'Anon direct RPC call attempt'
    );
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_code := SQLSTATE;
    v_error_message := SQLERRM;
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 2c FAILED: Anon was able to execute request_booking_atomic_v2!';
  END IF;
  IF v_error_code != '42501' AND v_error_message NOT LIKE '%permission denied%' THEN
    RAISE EXCEPTION 'TEST 2c FAILED: Expected permission denied (42501), got [%: %]', v_error_code, v_error_message;
  END IF;
  RAISE NOTICE 'PASS: TEST 2c - Anon calling request_booking_atomic_v2 refused with permission error (SQLSTATE: %, Error: %).',
    v_error_code, v_error_message;


  -- ===========================================================================
  -- TEST 3: Direct INSERT into bookings as anon is REFUSED
  -- ===========================================================================
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);

  v_error_caught := false;
  v_error_code := '';
  v_error_message := '';
  BEGIN
    INSERT INTO public.bookings (
      tourist_id, room_id, check_in_date, check_out_date,
      guest_count, total_price, downpayment_amount, commission_amount,
      convenience_fee, payment_status, status
    ) VALUES (
      v_tourist_id, v_room_id, v_today_manila + 15, v_today_manila + 17,
      2, 1000.00, 10.00, 1.00,
      0.00, 'verified', 'accepted'
    );
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_code := SQLSTATE;
    v_error_message := SQLERRM;
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Direct INSERT by anon was NOT rejected by RLS!';
  END IF;
  RAISE NOTICE 'PASS: TEST 3 - Direct INSERT by anon refused by RLS (SQLSTATE: %, Error: %).',
    v_error_code, v_error_message;

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'ALL BOOKING INSERT POLICY TESTS PASSED SUCCESSFULLY!';
  RAISE NOTICE '=======================================================';
END $$;

ROLLBACK;
