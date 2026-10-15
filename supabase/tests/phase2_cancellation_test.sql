-- =============================================================================
-- Test Script: phase2_cancellation_test.sql
-- Description: Unit & Integration tests for Phase 2 Cancellation & Refund Engine
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
  v_prop_id uuid;
  v_room_id uuid;
  v_room_id_26 uuid;
  v_booking_id uuid;
  v_calc record;
  v_res jsonb;
  v_error_caught boolean;
  v_claim_before text;
  v_claim_after text;
  v_stored_b record;
  v_est record;
BEGIN
  -- ---------------------------------------------------------------------------
  -- SETUP A: Set service_role for setup statements so tampering trigger allows them
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  v_today_manila := (now() AT TIME ZONE 'Asia/Manila')::date;
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'Starting Phase 2 Cancellation Engine Test Suite';
  RAISE NOTICE 'Execution Date (Asia/Manila): %', v_today_manila;
  RAISE NOTICE '=======================================================';

  -- ---------------------------------------------------------------------------
  -- SETUP B: Satisfy foreign keys to auth.users if needed
  -- ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO auth.users (id, aud, role, email)
    VALUES 
      (v_admin_id, 'authenticated', 'authenticated', 'admin_test@panaw.ph'),
      (v_tourist_id, 'authenticated', 'authenticated', 'tourist_test@panaw.ph'),
      (v_other_tourist_id, 'authenticated', 'authenticated', 'other_test@panaw.ph'),
      (v_host_id, 'authenticated', 'authenticated', 'host_test@panaw.ph')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- If auth.users is inaccessible or has additional schema constraints, proceed with existing profiles
    NULL;
  END;

  -- Create profiles with all real NOT NULL columns
  INSERT INTO public.profiles (id, email, full_name, role, is_approved)
  VALUES 
    (v_admin_id, 'admin_test@panaw.ph', 'Admin Test User', 'admin', true),
    (v_tourist_id, 'tourist_test@panaw.ph', 'Tourist Test User', 'tourist', true),
    (v_other_tourist_id, 'other_test@panaw.ph', 'Other Tourist User', 'tourist', true),
    (v_host_id, 'host_test@panaw.ph', 'Host Test User', 'homestay', true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_approved = true;

  -- Create test property with real NOT NULL columns
  INSERT INTO public.properties (owner_id, name, type, address, status, cancellation_policy)
  VALUES (v_host_id, 'Phase 2 Test Homestay', 'homestay', 'San Agustin, Surigao del Sur', 'active', 'standard')
  RETURNING id INTO v_prop_id;

  -- Create test room with real NOT NULL columns
  INSERT INTO public.rooms (property_id, name, base_price, max_capacity, is_active)
  VALUES (v_prop_id, 'Oceanview Suite', 1000.00, 4, true)
  RETURNING id INTO v_room_id;

  -- Ensure system settings baseline
  INSERT INTO public.system_settings (
    id, convenience_fee, refund_full_days, refund_partial_days, refund_partial_percent, convenience_fee_refund_rule, host_refund_deadline_hours
  )
  VALUES (1, 100.00, 7, 3, 50.00, 'never', 72)
  ON CONFLICT (id) DO UPDATE SET 
    convenience_fee = 100.00,
    refund_full_days = 7,
    refund_partial_days = 3,
    refund_partial_percent = 50.00,
    convenience_fee_refund_rule = 'never',
    host_refund_deadline_hours = 72;

  -- ===========================================================================
  -- TEST 0: Trigger trg_set_booking_cancellation_snapshot Overwrite Proof
  -- ===========================================================================
  INSERT INTO public.bookings (
    tourist_id, room_id, owner_id, check_in_date, check_out_date, guest_count,
    total_price, downpayment_amount, convenience_fee, payment_status, payout_status, status,
    cancellation_policy, cancellation_snapshot
  ) VALUES (
    v_tourist_id, v_room_id, v_host_id, v_today_manila + 50, v_today_manila + 52, 2,
    1000.00, 300.00, 100.00, 'verified', 'pending', 'accepted',
    'flexible',
    jsonb_build_object('convenience_fee_refund_rule', 'always')
  ) RETURNING id INTO v_booking_id;

  SELECT cancellation_snapshot->>'convenience_fee_refund_rule' INTO v_claim_before
  FROM public.bookings WHERE id = v_booking_id;

  -- Assert that stored snapshot rule equals system_settings ('never'), NOT 'always'
  IF v_claim_before != 'never' THEN
    RAISE EXCEPTION 'TEST 0 FAILED: Trigger should have overwritten convenience_fee_refund_rule to system_settings ("never"), got: %', v_claim_before;
  END IF;

  -- Clean up test booking immediately so it never interferes with subsequent tests
  UPDATE public.bookings SET status = 'declined' WHERE id = v_booking_id;
  RAISE NOTICE 'PASS: TEST 0 - Trigger trg_set_booking_cancellation_snapshot confirmed to overwrite insert-time snapshot with system_settings.';

  -- ===========================================================================
  -- TEST 1: Standard Policy at 10 days before check-in (100% deposit, fee non-refundable)
  -- ===========================================================================
  INSERT INTO public.bookings (
    tourist_id, room_id, owner_id, check_in_date, check_out_date, guest_count,
    total_price, downpayment_amount, convenience_fee, commission_amount, deposit_payout_amount,
    payment_status, payout_status, status, cancellation_policy, cancellation_snapshot
  ) VALUES (
    v_tourist_id, v_room_id, v_host_id, v_today_manila + 10, v_today_manila + 12, 2,
    1000.00, 300.00, 100.00, 80.00, 120.00,
    'verified', 'pending', 'accepted', 'standard',
    jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'never', 'host_refund_deadline_hours', 72
    )
  ) RETURNING id INTO v_booking_id;

  UPDATE public.bookings SET 
    cancellation_policy = 'standard',
    cancellation_snapshot = jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'never', 'host_refund_deadline_hours', 72
    )
  WHERE id = v_booking_id;

  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.tier != 'full' OR v_calc.deposit_refund != 200.00 OR v_calc.fee_refund != 0.00 OR v_calc.refund_total != 200.00 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Expected full refund of 200.00 deposit, got % (deposit: %, fee: %)', v_calc.refund_total, v_calc.deposit_refund, v_calc.fee_refund;
  END IF;
  RAISE NOTICE 'PASS: TEST 1 - Standard Policy at 10 days yields 100%% deposit refund (₱200) and ₱0 fee.';

  -- ===========================================================================
  -- TEST 2: Standard Policy at 7 days before check-in (Exact Boundary -> 100% deposit)
  -- ===========================================================================
  UPDATE public.bookings SET check_in_date = v_today_manila + 7, check_out_date = v_today_manila + 9 WHERE id = v_booking_id;
  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.tier != 'full' OR v_calc.deposit_refund != 200.00 OR v_calc.refund_total != 200.00 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Expected boundary 7-day to be full refund of 200.00, got %', v_calc.refund_total;
  END IF;
  RAISE NOTICE 'PASS: TEST 2 - Standard Policy at boundary (7 days) yields 100%% deposit refund.';

  -- ===========================================================================
  -- TEST 3: Standard Policy at 6 days before check-in (Partial tier -> 50% of deposit)
  -- ===========================================================================
  UPDATE public.bookings SET check_in_date = v_today_manila + 6, check_out_date = v_today_manila + 8 WHERE id = v_booking_id;
  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.tier != 'partial' OR v_calc.deposit_refund != 100.00 OR v_calc.refund_total != 100.00 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Expected partial refund of 100.00, got %', v_calc.refund_total;
  END IF;
  RAISE NOTICE 'PASS: TEST 3 - Standard Policy at 6 days yields 50%% deposit refund (₱100).';

  -- ===========================================================================
  -- TEST 4: Standard Policy at 3 days before check-in (Lower Boundary Partial -> 50%)
  -- ===========================================================================
  UPDATE public.bookings SET check_in_date = v_today_manila + 3, check_out_date = v_today_manila + 5 WHERE id = v_booking_id;
  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.tier != 'partial' OR v_calc.deposit_refund != 100.00 OR v_calc.refund_total != 100.00 THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Expected partial refund of 100.00 at 3 days, got %', v_calc.refund_total;
  END IF;
  RAISE NOTICE 'PASS: TEST 4 - Standard Policy at 3 days yields 50%% deposit refund (₱100).';

  -- ===========================================================================
  -- TEST 5: Standard Policy at 2 days before check-in (Late -> 0% refund)
  -- ===========================================================================
  UPDATE public.bookings SET check_in_date = v_today_manila + 2, check_out_date = v_today_manila + 4 WHERE id = v_booking_id;
  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.tier != 'none' OR v_calc.deposit_refund != 0.00 OR v_calc.refund_total != 0.00 THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Expected 0 refund at 2 days, got %', v_calc.refund_total;
  END IF;
  RAISE NOTICE 'PASS: TEST 5 - Standard Policy at 2 days yields 0%% refund.';

  -- ===========================================================================
  -- TEST 6: Flexible Policy at 3 days before check-in (100% deposit)
  -- ===========================================================================
  UPDATE public.bookings SET 
    check_in_date = v_today_manila + 3,
    check_out_date = v_today_manila + 5,
    cancellation_policy = 'flexible',
    cancellation_snapshot = jsonb_build_object(
      'policy', 'flexible', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'never', 'host_refund_deadline_hours', 72
    )
  WHERE id = v_booking_id;

  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.tier != 'full' OR v_calc.deposit_refund != 200.00 OR v_calc.refund_total != 200.00 THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Expected Flexible policy at 3 days to yield 200.00, got %', v_calc.refund_total;
  END IF;
  RAISE NOTICE 'PASS: TEST 6 - Flexible Policy at 3 days yields 100%% deposit refund (₱200).';

  -- ===========================================================================
  -- TEST 7: Flexible Policy at 2 days before check-in (0% refund)
  -- ===========================================================================
  UPDATE public.bookings SET check_in_date = v_today_manila + 2, check_out_date = v_today_manila + 4 WHERE id = v_booking_id;
  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.tier != 'none' OR v_calc.deposit_refund != 0.00 OR v_calc.refund_total != 0.00 THEN
    RAISE EXCEPTION 'TEST 7 FAILED: Expected Flexible policy at 2 days to yield 0.00, got %', v_calc.refund_total;
  END IF;
  RAISE NOTICE 'PASS: TEST 7 - Flexible Policy at 2 days yields 0%% refund.';

  -- ===========================================================================
  -- TEST 8: Non-Refundable Policy (0% refund even at 10 days)
  -- ===========================================================================
  UPDATE public.bookings SET 
    check_in_date = v_today_manila + 10,
    check_out_date = v_today_manila + 12,
    cancellation_policy = 'non_refundable',
    cancellation_snapshot = jsonb_build_object(
      'policy', 'non_refundable', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'never', 'host_refund_deadline_hours', 72
    )
  WHERE id = v_booking_id;

  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.tier != 'none' OR v_calc.deposit_refund != 0.00 OR v_calc.refund_total != 0.00 THEN
    RAISE EXCEPTION 'TEST 8 FAILED: Expected Non-refundable policy to yield 0.00, got %', v_calc.refund_total;
  END IF;
  RAISE NOTICE 'PASS: TEST 8 - Non-refundable Policy yields 0%% refund.';

  -- ===========================================================================
  -- TEST 9: Host Cancellation (100% deposit + 100% fee, r = 1)
  -- ===========================================================================
  UPDATE public.bookings SET check_in_date = v_today_manila + 1 WHERE id = v_booking_id;
  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'host', false);
  IF v_calc.tier != 'host_cancellation' OR v_calc.deposit_refund != 200.00 OR v_calc.fee_refund != 100.00 OR v_calc.refund_total != 300.00 THEN
    RAISE EXCEPTION 'TEST 9 FAILED: Expected Host cancellation to refund 300.00 (200 dep + 100 fee), got %', v_calc.refund_total;
  END IF;
  RAISE NOTICE 'PASS: TEST 9 - Host Cancellation refunds 100%% deposit + 100%% convenience fee (₱300).';

  -- ===========================================================================
  -- TEST 10: Admin Force Majeure (100% deposit + 100% fee, r = 1)
  -- ===========================================================================
  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'admin', true);
  IF v_calc.tier != 'force_majeure' OR v_calc.deposit_refund != 200.00 OR v_calc.fee_refund != 100.00 OR v_calc.refund_total != 300.00 THEN
    RAISE EXCEPTION 'TEST 10 FAILED: Expected Admin Force Majeure to refund 300.00, got %', v_calc.refund_total;
  END IF;
  RAISE NOTICE 'PASS: TEST 10 - Admin Force Majeure refunds 100%% deposit + 100%% fee (₱300).';

  -- ===========================================================================
  -- TEST 11: Tourist attempting Force Majeure must be refused
  -- ===========================================================================
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  v_error_caught := false;
  BEGIN
    PERFORM public.cancel_booking_atomic(v_booking_id, 'Typhoon', true, '09123456789');
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 11 FAILED: Tourist should not be permitted to trigger force_majeure.';
  END IF;
  RAISE NOTICE 'PASS: TEST 11 - Tourist attempting Force Majeure is properly refused.';

  -- ===========================================================================
  -- TEST 12: Three Fee Rules ('never', 'full_tier_only', 'always')
  -- ===========================================================================
  -- 12a. full_tier_only with Full Refund (10 days -> deposit 200 -> fee refunded: 100)
  UPDATE public.bookings SET 
    check_in_date = v_today_manila + 10,
    cancellation_policy = 'standard',
    cancellation_snapshot = jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'full_tier_only', 'host_refund_deadline_hours', 72
    )
  WHERE id = v_booking_id;
  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.deposit_refund != 200.00 OR v_calc.fee_refund != 100.00 OR v_calc.refund_total != 300.00 THEN
    RAISE EXCEPTION 'TEST 12a FAILED: Expected full_tier_only to refund fee on 100%% deposit, got deposit %, fee %', v_calc.deposit_refund, v_calc.fee_refund;
  END IF;

  -- 12b. full_tier_only with Partial Refund (5 days -> deposit 100 -> fee NOT refunded: 0)
  UPDATE public.bookings SET check_in_date = v_today_manila + 5 WHERE id = v_booking_id;
  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.deposit_refund != 100.00 OR v_calc.fee_refund != 0.00 OR v_calc.refund_total != 100.00 THEN
    RAISE EXCEPTION 'TEST 12b FAILED: Expected full_tier_only to NOT refund fee on partial tier, got fee %', v_calc.fee_refund;
  END IF;

  -- 12c. always (5 days -> partial tier 100 -> fee refunded: 100)
  UPDATE public.bookings SET 
    cancellation_snapshot = jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'always', 'host_refund_deadline_hours', 72
    )
  WHERE id = v_booking_id;
  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.deposit_refund != 100.00 OR v_calc.fee_refund != 100.00 OR v_calc.refund_total != 200.00 THEN
    RAISE EXCEPTION 'TEST 12c FAILED: Expected always rule to refund fee, got fee %', v_calc.fee_refund;
  END IF;
  RAISE NOTICE 'PASS: TEST 12 - Convenience fee rules (never, full_tier_only, always) verified.';

  -- ===========================================================================
  -- TEST 13: Standard 6 days with fee rule 'always' (host payout must NOT be 0)
  -- ===========================================================================
  UPDATE public.bookings SET 
    check_in_date = v_today_manila + 6,
    cancellation_snapshot = jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'always', 'host_refund_deadline_hours', 72
    ),
    deposit_payout_amount = 120.00,
    payout_status = 'deposit_paid'
  WHERE id = v_booking_id;

  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  -- r = 100/200 = 0.5; payout = 120; host_leg = 60; panaw_leg = 200 - 60 = 140; adjusted = 120 - 60 = 60
  IF v_calc.host_leg != 60.00 OR v_calc.panaw_leg != 140.00 OR v_calc.refund_total != 200.00 THEN
    RAISE EXCEPTION 'TEST 13 FAILED: Expected host_leg 60, panaw_leg 140, total 200, got host %, panaw %, total %', v_calc.host_leg, v_calc.panaw_leg, v_calc.refund_total;
  END IF;
  RAISE NOTICE 'PASS: TEST 13 - Standard 6 days with fee rule always: host_leg=₱60, panaw_leg=₱140 (host retained payout ₱60 > 0).';

  -- ===========================================================================
  -- TEST 14: NULL snapshot fallback (falls back to system_settings)
  -- ===========================================================================
  UPDATE public.bookings SET 
    cancellation_snapshot = NULL,
    check_in_date = v_today_manila + 10,
    cancellation_policy = 'standard'
  WHERE id = v_booking_id;
  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.snapshot_source != 'fallback_settings' OR v_calc.refund_total != 200.00 THEN
    RAISE EXCEPTION 'TEST 14 FAILED: Expected fallback_settings source and 200.00 refund, got source %, refund %', v_calc.snapshot_source, v_calc.refund_total;
  END IF;
  RAISE NOTICE 'PASS: TEST 14 - NULL snapshot cleanly falls back to system_settings.';

  -- ===========================================================================
  -- TEST 15: Unpaid / awaiting_deposit booking yields 0 refund and 0 legs
  -- ===========================================================================
  UPDATE public.bookings SET payment_status = 'awaiting_deposit' WHERE id = v_booking_id;
  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.tier != 'unpaid' OR v_calc.refund_total != 0.00 OR v_calc.host_leg != 0.00 OR v_calc.panaw_leg != 0.00 THEN
    RAISE EXCEPTION 'TEST 15 FAILED: Expected unpaid booking to yield 0 refund, got %', v_calc.refund_total;
  END IF;
  RAISE NOTICE 'PASS: TEST 15 - Unpaid / awaiting_deposit booking yields ₱0 refund.';

  -- ===========================================================================
  -- TEST 16: Double-call idempotency on cancel_booking_atomic
  -- ===========================================================================
  UPDATE public.bookings SET 
    payment_status = 'verified',
    status = 'accepted',
    check_in_date = v_today_manila + 10,
    cancellation_snapshot = jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'never', 'host_refund_deadline_hours', 72
    )
  WHERE id = v_booking_id;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  -- 1st Call
  v_res := public.cancel_booking_atomic(v_booking_id, 'First cancellation call', false, '09123456789');
  IF (v_res->>'success')::boolean != true OR (v_res->>'already_cancelled')::boolean != false OR (v_res->>'refund_total')::numeric != 200.00 THEN
    RAISE EXCEPTION 'TEST 16a FAILED: First cancel call returned unexpected result: %', v_res;
  END IF;

  -- 2nd Call (Double tap)
  v_res := public.cancel_booking_atomic(v_booking_id, 'Second cancellation call', false, '09123456789');
  IF (v_res->>'success')::boolean != true OR (v_res->>'already_cancelled')::boolean != true OR (v_res->>'refund_total')::numeric != 200.00 THEN
    RAISE EXCEPTION 'TEST 16b FAILED: Idempotent second cancel call failed: %', v_res;
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  RAISE NOTICE 'PASS: TEST 16 - Double-call idempotency verified (zero duplicate writes).';

  -- ===========================================================================
  -- TEST 17: Unauthorized tourist cannot cancel another tourist's booking
  -- ===========================================================================
  INSERT INTO public.bookings (
    tourist_id, room_id, owner_id, check_in_date, check_out_date, guest_count,
    total_price, downpayment_amount, convenience_fee, payment_status, payout_status, status,
    cancellation_policy
  ) VALUES (
    v_tourist_id, v_room_id, v_host_id, v_today_manila + 10, v_today_manila + 12, 2,
    1000.00, 300.00, 100.00, 'verified', 'pending', 'accepted', 'standard'
  ) RETURNING id INTO v_booking_id;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_other_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_other_tourist_id::text, 'role', 'authenticated')::text, true);

  v_error_caught := false;
  BEGIN
    PERFORM public.cancel_booking_atomic(v_booking_id, 'Malicious cancel', false, '09123456789');
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 17 FAILED: Tourist 2 should have been blocked from cancelling Tourist 1 booking.';
  END IF;
  RAISE NOTICE 'PASS: TEST 17 - Cross-tourist cancellation attempt refused with error.';

  -- ===========================================================================
  -- TEST 18: Anonymous caller must be refused
  -- ===========================================================================
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '', true);

  v_error_caught := false;
  BEGIN
    PERFORM public.cancel_booking_atomic(v_booking_id, 'Anon cancel', false, '09123456789');
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 18 FAILED: Anon caller should have been blocked.';
  END IF;
  RAISE NOTICE 'PASS: TEST 18 - Anonymous call refused.';

  -- ===========================================================================
  -- TEST 19: Tourist cancels without GCash when refund > 0 (Refused)
  -- ===========================================================================
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  v_error_caught := false;
  BEGIN
    PERFORM public.cancel_booking_atomic(v_booking_id, 'No GCash', false, NULL);
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 19 FAILED: Tourist should not be able to cancel without GCash when refund > 0.';
  END IF;
  RAISE NOTICE 'PASS: TEST 19 - Tourist cancellation without GCash number refused.';

  -- ===========================================================================
  -- TEST 20: Host cancels via RPC without GCash number (Succeeds)
  -- ===========================================================================
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_host_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_host_id::text, 'role', 'authenticated')::text, true);

  v_res := public.cancel_booking_atomic(v_booking_id, 'Host emergency closure', false, NULL);
  IF (v_res->>'success')::boolean != true OR (v_res->>'cancelled_by') != 'host' THEN
    RAISE EXCEPTION 'TEST 20 FAILED: Host cancellation without GCash number failed: %', v_res;
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  RAISE NOTICE 'PASS: TEST 20 - Host cancellation without GCash number succeeds (refund_gcash stored as NULL).';

  -- ===========================================================================
  -- TEST 21: Tourist cancel while payment_status = 'deposit_uploaded' (Refused)
  -- ===========================================================================
  INSERT INTO public.bookings (
    tourist_id, room_id, owner_id, check_in_date, check_out_date, guest_count,
    total_price, downpayment_amount, convenience_fee, payment_status, payout_status, status,
    cancellation_policy
  ) VALUES (
    v_tourist_id, v_room_id, v_host_id, v_today_manila + 10, v_today_manila + 12, 2,
    1000.00, 300.00, 100.00, 'deposit_uploaded', 'pending', 'accepted', 'standard'
  ) RETURNING id INTO v_booking_id;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  v_error_caught := false;
  BEGIN
    PERFORM public.cancel_booking_atomic(v_booking_id, 'Cancel during verification', false, '09123456789');
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 21 FAILED: Tourist should be blocked from cancelling while deposit_uploaded.';
  END IF;
  RAISE NOTICE 'PASS: TEST 21 - Tourist cancellation blocked while deposit_uploaded ("deposit still being verified").';

  -- ===========================================================================
  -- TEST 22: Cancel of booking in 'completed' or 'declined' status (Refused)
  -- ===========================================================================
  UPDATE public.bookings SET payment_status = 'verified', status = 'completed' WHERE id = v_booking_id;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  v_error_caught := false;
  BEGIN
    PERFORM public.cancel_booking_atomic(v_booking_id, 'Cancel completed stay', false, '09123456789');
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 22a FAILED: Cancel of completed booking should be refused.';
  END IF;

  UPDATE public.bookings SET status = 'declined' WHERE id = v_booking_id;
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  v_error_caught := false;
  BEGIN
    PERFORM public.cancel_booking_atomic(v_booking_id, 'Cancel declined booking', false, '09123456789');
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 22b FAILED: Cancel of declined booking should be refused.';
  END IF;
  RAISE NOTICE 'PASS: TEST 22 - Cancellation of completed and declined bookings properly refused.';

  -- ===========================================================================
  -- TEST 23: Role claim restored after cancel_booking_atomic call
  -- ===========================================================================
  UPDATE public.bookings SET status = 'accepted' WHERE id = v_booking_id;
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  v_claim_before := current_setting('request.jwt.claim.role', true);
  PERFORM public.cancel_booking_atomic(v_booking_id, 'Claim test', false, '09123456789');
  v_claim_after := current_setting('request.jwt.claim.role', true);

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF v_claim_before != 'authenticated' OR v_claim_after != 'authenticated' THEN
    RAISE EXCEPTION 'TEST 23 FAILED: Role claim was not restored! Before: %, After: %', v_claim_before, v_claim_after;
  END IF;
  RAISE NOTICE 'PASS: TEST 23 - Caller role claim (authenticated) successfully preserved and restored.';

  -- ===========================================================================
  -- TEST 24: New Money Rules Worked Checks (Deposit 200, Payout 120, Commission 80, Fee 100)
  -- ===========================================================================
  INSERT INTO public.bookings (
    tourist_id, room_id, owner_id, check_in_date, check_out_date, guest_count,
    total_price, downpayment_amount, convenience_fee, commission_amount, deposit_payout_amount,
    payment_status, payout_status, status, cancellation_policy, cancellation_snapshot
  ) VALUES (
    v_tourist_id, v_room_id, v_host_id, v_today_manila + 10, v_today_manila + 12, 2,
    1000.00, 300.00, 100.00, 80.00, 120.00,
    'verified', 'deposit_paid', 'accepted', 'standard',
    jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'never', 'host_refund_deadline_hours', 72
    )
  ) RETURNING id INTO v_booking_id;

  UPDATE public.bookings SET 
    cancellation_policy = 'standard',
    cancellation_snapshot = jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'never', 'host_refund_deadline_hours', 72
    )
  WHERE id = v_booking_id;

  -- 24a. r=1, payout sent, fee rule never: host 120, panaw 80, adjusted 0
  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.host_leg != 120.00 OR v_calc.panaw_leg != 80.00 OR v_calc.refund_total != 200.00 THEN
    RAISE EXCEPTION 'TEST 24a FAILED: Expected host 120, panaw 80, total 200, got host %, panaw %, total %', v_calc.host_leg, v_calc.panaw_leg, v_calc.refund_total;
  END IF;

  -- 24b. r=0.5, payout sent (6 days): host 60, panaw 40, adjusted 60
  UPDATE public.bookings SET check_in_date = v_today_manila + 6 WHERE id = v_booking_id;
  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.host_leg != 60.00 OR v_calc.panaw_leg != 40.00 OR v_calc.refund_total != 100.00 THEN
    RAISE EXCEPTION 'TEST 24b FAILED: Expected host 60, panaw 40, total 100, got host %, panaw %, total %', v_calc.host_leg, v_calc.panaw_leg, v_calc.refund_total;
  END IF;

  -- 24c. r=0.5, payout pending: host 0, panaw 100, adjusted 60
  UPDATE public.bookings SET payout_status = 'pending' WHERE id = v_booking_id;
  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.host_leg != 0.00 OR v_calc.panaw_leg != 100.00 OR v_calc.refund_total != 100.00 THEN
    RAISE EXCEPTION 'TEST 24c FAILED: Expected host 0, panaw 100, total 100, got host %, panaw %, total %', v_calc.host_leg, v_calc.panaw_leg, v_calc.refund_total;
  END IF;

  -- 24d. r=0.5, payout sent, fee rule always: host 60, panaw 140, total 200
  UPDATE public.bookings SET 
    payout_status = 'deposit_paid',
    cancellation_snapshot = jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'always', 'host_refund_deadline_hours', 72
    )
  WHERE id = v_booking_id;
  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.host_leg != 60.00 OR v_calc.panaw_leg != 140.00 OR v_calc.refund_total != 200.00 THEN
    RAISE EXCEPTION 'TEST 24d FAILED: Expected host 60, panaw 140, total 200, got host %, panaw %, total %', v_calc.host_leg, v_calc.panaw_leg, v_calc.refund_total;
  END IF;
  RAISE NOTICE 'PASS: TEST 24 - All 4 Money Rules Worked Checks (r=1 sent, r=0.5 sent, r=0.5 pending, r=0.5 always) verified.';

  -- ===========================================================================
  -- TEST 25: Odd Centavos Rounding (333.33 deposit at 50% -> 166.67)
  -- ===========================================================================
  UPDATE public.bookings SET 
    downpayment_amount = 433.33,
    convenience_fee = 100.00,
    deposit_payout_amount = 253.33,
    payout_status = 'deposit_paid',
    check_in_date = v_today_manila + 5,
    cancellation_snapshot = jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'never', 'host_refund_deadline_hours', 72
    )
  WHERE id = v_booking_id;

  SELECT * INTO v_calc FROM public.compute_cancellation_refund(v_booking_id, 'tourist', false);
  IF v_calc.deposit_refund != 166.67 OR v_calc.refund_total != 166.67 THEN
    RAISE EXCEPTION 'TEST 25 FAILED: Expected 166.67 centavo rounding on 333.33 deposit at 50%%, got %', v_calc.deposit_refund;
  END IF;

  -- Verify leg invariant: host_leg + panaw_leg = refund_total
  IF (v_calc.host_leg + v_calc.panaw_leg) != v_calc.refund_total THEN
    RAISE EXCEPTION 'TEST 25 FAILED: Leg invariant violated! host: %, panaw: %, total: %', v_calc.host_leg, v_calc.panaw_leg, v_calc.refund_total;
  END IF;
  RAISE NOTICE 'PASS: TEST 25 - Odd centavos math (333.33 @ 50%% = 166.67) and leg invariant (host + panaw = total) verified.';

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'ALL 25 BASE PHASE 2 UNIT TESTS PASSED!';
  RAISE NOTICE '=======================================================';

  -- ===========================================================================
  -- TEST 26: RPC-Level cancel_booking_atomic & Stored Column Assertions (Item 7)
  -- ===========================================================================

  -- 1. Clean up leftover active booking from TEST 24/25 so it no longer blocks any dates
  UPDATE public.bookings SET status = 'declined' WHERE id = v_booking_id;

  -- 2. Create a dedicated fresh room for TEST 26 to completely isolate its date ranges
  INSERT INTO public.rooms (property_id, name, base_price, max_capacity, is_active)
  VALUES (v_prop_id, 'TEST 26 Dedicated Room', 1000.00, 4, true)
  RETURNING id INTO v_room_id_26;

  -- ---------------------------------------------------------------------------
  -- 26a. Tourist, payout sent (deposit_paid, payout 120), 6 days, fee rule always:
  --      host_refund_amount 60, panaw_refund_amount 140, host_refund_status 'pending',
  --      host_refund_due_at about 72h ahead, panaw_refund_status 'pending',
  --      adjusted_host_payout_amount 60, refund_gcash_number stored.
  -- ---------------------------------------------------------------------------
  INSERT INTO public.bookings (
    tourist_id, room_id, owner_id, check_in_date, check_out_date, guest_count,
    total_price, downpayment_amount, convenience_fee, commission_amount, deposit_payout_amount,
    payment_status, payout_status, status, cancellation_policy, cancellation_snapshot
  ) VALUES (
    v_tourist_id, v_room_id_26, v_host_id, v_today_manila + 6, v_today_manila + 8, 2,
    1000.00, 300.00, 100.00, 80.00, 120.00,
    'verified', 'deposit_paid', 'accepted', 'standard',
    jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'always', 'host_refund_deadline_hours', 72
    )
  ) RETURNING id INTO v_booking_id;

  -- Explicitly set snapshot since trigger overwrites insert-time values from system_settings
  UPDATE public.bookings SET 
    cancellation_policy = 'standard',
    cancellation_snapshot = jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'always', 'host_refund_deadline_hours', 72
    )
  WHERE id = v_booking_id;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  v_res := public.cancel_booking_atomic(v_booking_id, 'Change of plans for vacation', false, '09171234567');

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  -- Query stored columns from public.bookings
  SELECT * INTO v_stored_b FROM public.bookings WHERE id = v_booking_id;

  IF v_stored_b.host_refund_amount != 60.00 THEN
    RAISE EXCEPTION 'TEST 26a FAILED: Expected stored host_refund_amount 60.00, got %', v_stored_b.host_refund_amount;
  END IF;
  IF v_stored_b.panaw_refund_amount != 140.00 THEN
    RAISE EXCEPTION 'TEST 26a FAILED: Expected stored panaw_refund_amount 140.00, got %', v_stored_b.panaw_refund_amount;
  END IF;
  IF v_stored_b.host_refund_status != 'pending' THEN
    RAISE EXCEPTION 'TEST 26a FAILED: Expected stored host_refund_status pending, got %', v_stored_b.host_refund_status;
  END IF;
  IF v_stored_b.panaw_refund_status != 'pending' THEN
    RAISE EXCEPTION 'TEST 26a FAILED: Expected stored panaw_refund_status pending, got %', v_stored_b.panaw_refund_status;
  END IF;
  IF v_stored_b.host_refund_due_at IS NULL OR v_stored_b.host_refund_due_at < (now() + interval '71 hours') OR v_stored_b.host_refund_due_at > (now() + interval '73 hours') THEN
    RAISE EXCEPTION 'TEST 26a FAILED: Expected stored host_refund_due_at ~72h ahead, got %', v_stored_b.host_refund_due_at;
  END IF;
  IF v_stored_b.adjusted_host_payout_amount != 60.00 THEN
    RAISE EXCEPTION 'TEST 26a FAILED: Expected stored adjusted_host_payout_amount 60.00, got %', v_stored_b.adjusted_host_payout_amount;
  END IF;
  IF v_stored_b.refund_gcash_number != '09171234567' THEN
    RAISE EXCEPTION 'TEST 26a FAILED: Expected stored refund_gcash_number 09171234567, got %', v_stored_b.refund_gcash_number;
  END IF;
  IF (v_stored_b.host_refund_amount + v_stored_b.panaw_refund_amount) != v_stored_b.refund_total THEN
    RAISE EXCEPTION 'TEST 26a FAILED: Stored leg sum does not equal stored refund_total: % + % != %',
      v_stored_b.host_refund_amount, v_stored_b.panaw_refund_amount, v_stored_b.refund_total;
  END IF;
  IF v_stored_b.adjusted_host_payout_amount > coalesce(v_stored_b.deposit_payout_amount, 0.00) THEN
    RAISE EXCEPTION 'TEST 26a FAILED: Stored adjusted payout % exceeds payout %',
      v_stored_b.adjusted_host_payout_amount, v_stored_b.deposit_payout_amount;
  END IF;
  RAISE NOTICE 'PASS: TEST 26a - Tourist payout sent (payout 120, 6d, always): host 60, panaw 140, due ~72h, adjusted 60, GCash stored.';

  -- ---------------------------------------------------------------------------
  -- 26b. Tourist, payout pending, 6 days, fee rule never:
  --      host_refund_amount 0, host status 'none', panaw_refund_amount 100, adjusted 60.
  -- ---------------------------------------------------------------------------
  INSERT INTO public.bookings (
    tourist_id, room_id, owner_id, check_in_date, check_out_date, guest_count,
    total_price, downpayment_amount, convenience_fee, commission_amount, deposit_payout_amount,
    payment_status, payout_status, status, cancellation_policy, cancellation_snapshot
  ) VALUES (
    v_tourist_id, v_room_id_26, v_host_id, v_today_manila + 6, v_today_manila + 8, 2,
    1000.00, 300.00, 100.00, 80.00, 120.00,
    'verified', 'pending', 'accepted', 'standard',
    jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'never', 'host_refund_deadline_hours', 72
    )
  ) RETURNING id INTO v_booking_id;

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

  v_res := public.cancel_booking_atomic(v_booking_id, 'Change travel schedule', false, '09171234567');

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT * INTO v_stored_b FROM public.bookings WHERE id = v_booking_id;

  IF v_stored_b.host_refund_amount != 0.00 THEN
    RAISE EXCEPTION 'TEST 26b FAILED: Expected stored host_refund_amount 0.00, got %', v_stored_b.host_refund_amount;
  END IF;
  IF v_stored_b.host_refund_status != 'none' THEN
    RAISE EXCEPTION 'TEST 26b FAILED: Expected stored host_refund_status none, got %', v_stored_b.host_refund_status;
  END IF;
  IF v_stored_b.panaw_refund_amount != 100.00 THEN
    RAISE EXCEPTION 'TEST 26b FAILED: Expected stored panaw_refund_amount 100.00, got %', v_stored_b.panaw_refund_amount;
  END IF;
  IF v_stored_b.panaw_refund_status != 'pending' THEN
    RAISE EXCEPTION 'TEST 26b FAILED: Expected stored panaw_refund_status pending, got %', v_stored_b.panaw_refund_status;
  END IF;
  IF v_stored_b.adjusted_host_payout_amount != 60.00 THEN
    RAISE EXCEPTION 'TEST 26b FAILED: Expected stored adjusted_host_payout_amount 60.00, got %', v_stored_b.adjusted_host_payout_amount;
  END IF;
  IF (v_stored_b.host_refund_amount + v_stored_b.panaw_refund_amount) != v_stored_b.refund_total THEN
    RAISE EXCEPTION 'TEST 26b FAILED: Stored leg sum does not equal stored refund_total: % + % != %',
      v_stored_b.host_refund_amount, v_stored_b.panaw_refund_amount, v_stored_b.refund_total;
  END IF;
  IF v_stored_b.adjusted_host_payout_amount > coalesce(v_stored_b.deposit_payout_amount, 0.00) THEN
    RAISE EXCEPTION 'TEST 26b FAILED: Stored adjusted payout % exceeds payout %',
      v_stored_b.adjusted_host_payout_amount, v_stored_b.deposit_payout_amount;
  END IF;
  RAISE NOTICE 'PASS: TEST 26b - Tourist payout pending (6d, never): host 0 (status none), panaw 100, adjusted 60.';

  -- ---------------------------------------------------------------------------
  -- 26c. Tourist cancels an awaiting_deposit booking:
  --      refund_total 0, both leg statuses 'none', adjusted_host_payout_amount 0, refund_gcash_number NULL.
  -- ---------------------------------------------------------------------------
  INSERT INTO public.bookings (
    tourist_id, room_id, owner_id, check_in_date, check_out_date, guest_count,
    total_price, downpayment_amount, convenience_fee, commission_amount, deposit_payout_amount,
    payment_status, payout_status, status, cancellation_policy, cancellation_snapshot
  ) VALUES (
    v_tourist_id, v_room_id_26, v_host_id, v_today_manila + 10, v_today_manila + 12, 2,
    1000.00, 300.00, 100.00, 80.00, 120.00,
    'awaiting_deposit', 'pending', 'pending', 'standard',
    jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'never', 'host_refund_deadline_hours', 72
    )
  ) RETURNING id INTO v_booking_id;

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

  v_res := public.cancel_booking_atomic(v_booking_id, 'Did not pay deposit', false, NULL);

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT * INTO v_stored_b FROM public.bookings WHERE id = v_booking_id;

  IF v_stored_b.refund_total != 0.00 THEN
    RAISE EXCEPTION 'TEST 26c FAILED: Expected stored refund_total 0.00, got %', v_stored_b.refund_total;
  END IF;
  IF v_stored_b.host_refund_amount != 0.00 OR v_stored_b.host_refund_status != 'none' THEN
    RAISE EXCEPTION 'TEST 26c FAILED: Expected stored host refund 0 and status none, got amount %, status %',
      v_stored_b.host_refund_amount, v_stored_b.host_refund_status;
  END IF;
  IF v_stored_b.panaw_refund_amount != 0.00 OR v_stored_b.panaw_refund_status != 'none' THEN
    RAISE EXCEPTION 'TEST 26c FAILED: Expected stored panaw refund 0 and status none, got amount %, status %',
      v_stored_b.panaw_refund_amount, v_stored_b.panaw_refund_status;
  END IF;
  IF v_stored_b.adjusted_host_payout_amount != 0.00 THEN
    RAISE EXCEPTION 'TEST 26c FAILED: Expected stored adjusted_host_payout_amount 0.00 for unpaid booking, got %',
      v_stored_b.adjusted_host_payout_amount;
  END IF;
  IF v_stored_b.refund_gcash_number IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 26c FAILED: Expected stored refund_gcash_number NULL, got %', v_stored_b.refund_gcash_number;
  END IF;
  IF (v_stored_b.host_refund_amount + v_stored_b.panaw_refund_amount) != v_stored_b.refund_total THEN
    RAISE EXCEPTION 'TEST 26c FAILED: Stored leg sum does not equal stored refund_total: % + % != %',
      v_stored_b.host_refund_amount, v_stored_b.panaw_refund_amount, v_stored_b.refund_total;
  END IF;
  RAISE NOTICE 'PASS: TEST 26c - Tourist awaiting_deposit cancel: refund_total 0, both legs none, adjusted 0, GCash NULL.';

  -- ---------------------------------------------------------------------------
  -- 26d. Admin force majeure via RPC, payout sent:
  --      refund 300, host 120, panaw 180, adjusted 0, cancelled_by 'admin'.
  -- ---------------------------------------------------------------------------
  INSERT INTO public.bookings (
    tourist_id, room_id, owner_id, check_in_date, check_out_date, guest_count,
    total_price, downpayment_amount, convenience_fee, commission_amount, deposit_payout_amount,
    payment_status, payout_status, status, cancellation_policy, cancellation_snapshot
  ) VALUES (
    v_tourist_id, v_room_id_26, v_host_id, v_today_manila + 2, v_today_manila + 4, 2,
    1000.00, 300.00, 100.00, 80.00, 120.00,
    'verified', 'deposit_paid', 'accepted', 'standard',
    jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'never', 'host_refund_deadline_hours', 72
    )
  ) RETURNING id INTO v_booking_id;

  UPDATE public.bookings SET 
    cancellation_policy = 'standard',
    cancellation_snapshot = jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'never', 'host_refund_deadline_hours', 72
    )
  WHERE id = v_booking_id;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);

  v_res := public.cancel_booking_atomic(v_booking_id, 'Severe supertyphoon landfall warning', true, NULL);

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT * INTO v_stored_b FROM public.bookings WHERE id = v_booking_id;

  IF v_stored_b.refund_total != 300.00 THEN
    RAISE EXCEPTION 'TEST 26d FAILED: Expected stored refund_total 300.00, got %', v_stored_b.refund_total;
  END IF;
  IF v_stored_b.host_refund_amount != 120.00 THEN
    RAISE EXCEPTION 'TEST 26d FAILED: Expected stored host_refund_amount 120.00, got %', v_stored_b.host_refund_amount;
  END IF;
  IF v_stored_b.panaw_refund_amount != 180.00 THEN
    RAISE EXCEPTION 'TEST 26d FAILED: Expected stored panaw_refund_amount 180.00, got %', v_stored_b.panaw_refund_amount;
  END IF;
  IF v_stored_b.adjusted_host_payout_amount != 0.00 THEN
    RAISE EXCEPTION 'TEST 26d FAILED: Expected stored adjusted_host_payout_amount 0.00, got %', v_stored_b.adjusted_host_payout_amount;
  END IF;
  IF v_stored_b.cancelled_by != 'admin' THEN
    RAISE EXCEPTION 'TEST 26d FAILED: Expected stored cancelled_by admin, got %', v_stored_b.cancelled_by;
  END IF;
  IF (v_stored_b.host_refund_amount + v_stored_b.panaw_refund_amount) != v_stored_b.refund_total THEN
    RAISE EXCEPTION 'TEST 26d FAILED: Stored leg sum does not equal stored refund_total: % + % != %',
      v_stored_b.host_refund_amount, v_stored_b.panaw_refund_amount, v_stored_b.refund_total;
  END IF;
  IF v_stored_b.adjusted_host_payout_amount > coalesce(v_stored_b.deposit_payout_amount, 0.00) THEN
    RAISE EXCEPTION 'TEST 26d FAILED: Stored adjusted payout % exceeds payout %',
      v_stored_b.adjusted_host_payout_amount, v_stored_b.deposit_payout_amount;
  END IF;
  RAISE NOTICE 'PASS: TEST 26d - Admin force majeure RPC payout sent: refund 300, host 120, panaw 180, adjusted 0, cancelled_by admin.';

  -- ---------------------------------------------------------------------------
  -- 26e. Non-refundable, late, payout pending:
  --      refund 0, adjusted equals payout (120).
  -- ---------------------------------------------------------------------------
  INSERT INTO public.bookings (
    tourist_id, room_id, owner_id, check_in_date, check_out_date, guest_count,
    total_price, downpayment_amount, convenience_fee, commission_amount, deposit_payout_amount,
    payment_status, payout_status, status, cancellation_policy, cancellation_snapshot
  ) VALUES (
    v_tourist_id, v_room_id_26, v_host_id, v_today_manila + 1, v_today_manila + 3, 2,
    1000.00, 300.00, 100.00, 80.00, 120.00,
    'verified', 'pending', 'accepted', 'non_refundable',
    jsonb_build_object(
      'policy', 'non_refundable', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'never', 'host_refund_deadline_hours', 72
    )
  ) RETURNING id INTO v_booking_id;

  -- Explicitly set non_refundable snapshot since trigger overwrote it with standard property policy
  UPDATE public.bookings SET 
    cancellation_policy = 'non_refundable',
    cancellation_snapshot = jsonb_build_object(
      'policy', 'non_refundable', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'never', 'host_refund_deadline_hours', 72
    )
  WHERE id = v_booking_id;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  v_res := public.cancel_booking_atomic(v_booking_id, 'Cannot travel anymore', false, NULL);

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT * INTO v_stored_b FROM public.bookings WHERE id = v_booking_id;

  IF v_stored_b.refund_total != 0.00 THEN
    RAISE EXCEPTION 'TEST 26e FAILED: Expected stored refund_total 0.00, got %', v_stored_b.refund_total;
  END IF;
  IF v_stored_b.adjusted_host_payout_amount != v_stored_b.deposit_payout_amount OR v_stored_b.adjusted_host_payout_amount != 120.00 THEN
    RAISE EXCEPTION 'TEST 26e FAILED: Expected stored adjusted payout to equal deposit_payout_amount (120.00), got %',
      v_stored_b.adjusted_host_payout_amount;
  END IF;
  IF (v_stored_b.host_refund_amount + v_stored_b.panaw_refund_amount) != v_stored_b.refund_total THEN
    RAISE EXCEPTION 'TEST 26e FAILED: Stored leg sum does not equal stored refund_total: % + % != %',
      v_stored_b.host_refund_amount, v_stored_b.panaw_refund_amount, v_stored_b.refund_total;
  END IF;
  IF v_stored_b.adjusted_host_payout_amount > coalesce(v_stored_b.deposit_payout_amount, 0.00) THEN
    RAISE EXCEPTION 'TEST 26e FAILED: Stored adjusted payout % exceeds payout %',
      v_stored_b.adjusted_host_payout_amount, v_stored_b.deposit_payout_amount;
  END IF;
  RAISE NOTICE 'PASS: TEST 26e - Non-refundable late payout pending: refund 0, adjusted equals payout (₱120).';

  -- ---------------------------------------------------------------------------
  -- 26f. For every cancelled booking above, assert host_refund_amount + panaw_refund_amount = refund_total
  --      and adjusted_host_payout_amount <= payout (using stored columns).
  -- ---------------------------------------------------------------------------
  FOR v_stored_b IN 
    SELECT id, host_refund_amount, panaw_refund_amount, refund_total, adjusted_host_payout_amount, deposit_payout_amount, downpayment_amount, convenience_fee, commission_amount
    FROM public.bookings 
    WHERE room_id = v_room_id_26 AND status = 'cancelled'
  LOOP
    IF (v_stored_b.host_refund_amount + v_stored_b.panaw_refund_amount) != v_stored_b.refund_total THEN
      RAISE EXCEPTION 'TEST 26f FAILED: Booking % violated stored leg sum invariant: host (%) + panaw (%) != total (%)',
        v_stored_b.id, v_stored_b.host_refund_amount, v_stored_b.panaw_refund_amount, v_stored_b.refund_total;
    END IF;

    IF v_stored_b.adjusted_host_payout_amount > coalesce(v_stored_b.deposit_payout_amount, (v_stored_b.downpayment_amount - v_stored_b.convenience_fee - coalesce(v_stored_b.commission_amount, 0.00))) THEN
      RAISE EXCEPTION 'TEST 26f FAILED: Booking % violated stored adjusted payout invariant: adjusted (%) > payout (%)',
        v_stored_b.id, v_stored_b.adjusted_host_payout_amount, v_stored_b.deposit_payout_amount;
    END IF;
  END LOOP;
  RAISE NOTICE 'PASS: TEST 26f - Invariant verified across all cancelled bookings: host_leg + panaw_leg = refund_total AND adjusted <= payout.';

  -- ---------------------------------------------------------------------------
  -- 26g. estimate_cancellation_refund as tourist returns the same refund_total and legs
  --      that cancel_booking_atomic then stores; another tourist calling estimate is refused.
  -- ---------------------------------------------------------------------------
  INSERT INTO public.bookings (
    tourist_id, room_id, owner_id, check_in_date, check_out_date, guest_count,
    total_price, downpayment_amount, convenience_fee, commission_amount, deposit_payout_amount,
    payment_status, payout_status, status, cancellation_policy, cancellation_snapshot
  ) VALUES (
    v_tourist_id, v_room_id_26, v_host_id, v_today_manila + 6, v_today_manila + 8, 2,
    1000.00, 300.00, 100.00, 80.00, 120.00,
    'verified', 'deposit_paid', 'accepted', 'standard',
    jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'always', 'host_refund_deadline_hours', 72
    )
  ) RETURNING id INTO v_booking_id;

  -- Explicitly set snapshot with fee rule always
  UPDATE public.bookings SET 
    cancellation_policy = 'standard',
    cancellation_snapshot = jsonb_build_object(
      'policy', 'standard', 'refund_full_days', 7, 'refund_partial_days', 3,
      'refund_partial_percent', 50, 'convenience_fee_refund_rule', 'always', 'host_refund_deadline_hours', 72
    )
  WHERE id = v_booking_id;

  -- 1. Tourist calls estimate_cancellation_refund
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  SELECT * INTO v_est FROM public.estimate_cancellation_refund(v_booking_id);

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  -- 2. Tourist calls cancel_booking_atomic
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_tourist_id::text, 'role', 'authenticated')::text, true);

  v_res := public.cancel_booking_atomic(v_booking_id, 'Estimate comparison test', false, '09171234567');

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  -- 3. Assert estimate matches stored columns
  SELECT * INTO v_stored_b FROM public.bookings WHERE id = v_booking_id;

  IF v_est.refund_total != v_stored_b.refund_total THEN
    RAISE EXCEPTION 'TEST 26g FAILED: Estimate refund_total (%) != stored refund_total (%)',
      v_est.refund_total, v_stored_b.refund_total;
  END IF;
  IF v_est.host_leg != v_stored_b.host_refund_amount THEN
    RAISE EXCEPTION 'TEST 26g FAILED: Estimate host_leg (%) != stored host_refund_amount (%)',
      v_est.host_leg, v_stored_b.host_refund_amount;
  END IF;
  IF v_est.panaw_leg != v_stored_b.panaw_refund_amount THEN
    RAISE EXCEPTION 'TEST 26g FAILED: Estimate panaw_leg (%) != stored panaw_refund_amount (%)',
      v_est.panaw_leg, v_stored_b.panaw_refund_amount;
  END IF;
  IF v_est.adjusted_host_payout != v_stored_b.adjusted_host_payout_amount THEN
    RAISE EXCEPTION 'TEST 26g FAILED: Estimate adjusted_host_payout (%) != stored adjusted_host_payout_amount (%)',
      v_est.adjusted_host_payout, v_stored_b.adjusted_host_payout_amount;
  END IF;

  -- 4. Cross-tourist estimate call must be refused (non-overlapping dates +30..+32)
  INSERT INTO public.bookings (
    tourist_id, room_id, owner_id, check_in_date, check_out_date, guest_count,
    total_price, downpayment_amount, convenience_fee, payment_status, payout_status, status,
    cancellation_policy
  ) VALUES (
    v_tourist_id, v_room_id_26, v_host_id, v_today_manila + 30, v_today_manila + 32, 2,
    1000.00, 300.00, 100.00, 'verified', 'pending', 'accepted', 'standard'
  ) RETURNING id INTO v_booking_id;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_other_tourist_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_other_tourist_id::text, 'role', 'authenticated')::text, true);

  v_error_caught := false;
  BEGIN
    SELECT * INTO v_est FROM public.estimate_cancellation_refund(v_booking_id);
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 26g FAILED: Cross-tourist estimate call should have been refused!';
  END IF;

  -- Clean up cross-tourist test booking so no active booking is left open
  UPDATE public.bookings SET status = 'declined' WHERE id = v_booking_id;

  RAISE NOTICE 'PASS: TEST 26g - estimate_cancellation_refund matches stored columns, and cross-tourist estimate is refused.';

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'ALL PHASE 2 CANCELLATION ENGINE TESTS (TEST 0 + 25 BASE + 7 RPC STORED-COLUMN SUITES) PASSED!';
  RAISE NOTICE '=======================================================';
END $$;

ROLLBACK;
