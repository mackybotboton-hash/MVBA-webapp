DO $$
DECLARE
  v_test_owner_id UUID;
  v_test_tourist_id UUID;
  v_prop_std_id UUID;
  v_prop_nonref_id UUID;
  v_room_std_id UUID;
  v_room_nonref_id UUID;
  v_booking_std_id UUID;
  v_booking_nonref_id UUID;
  v_snapshot_std JSONB;
  v_policy_std TEXT;
  v_policy_nonref TEXT;
BEGIN
  -- Grab a valid profile for foreign keys
  SELECT id INTO v_test_tourist_id FROM public.profiles LIMIT 1;
  IF v_test_tourist_id IS NULL THEN
    RAISE EXCEPTION 'Cannot test: No profile rows exist in database.';
  END IF;
  v_test_owner_id := v_test_tourist_id;

  -- 1. Create throwaway properties
  INSERT INTO public.properties (owner_id, name, type, cancellation_policy)
  VALUES (v_test_owner_id, '__THROWAWAY_STD_PROP__', 'homestay', 'standard')
  RETURNING id INTO v_prop_std_id;

  INSERT INTO public.properties (owner_id, name, type, cancellation_policy)
  VALUES (v_test_owner_id, '__THROWAWAY_NONREF_PROP__', 'resort', 'non_refundable')
  RETURNING id INTO v_prop_nonref_id;

  -- 2. Create throwaway rooms
  INSERT INTO public.rooms (property_id, name, base_price, max_capacity)
  VALUES (v_prop_std_id, '__THROWAWAY_STD_ROOM__', 1000, 2)
  RETURNING id INTO v_room_std_id;

  INSERT INTO public.rooms (property_id, name, base_price, max_capacity)
  VALUES (v_prop_nonref_id, '__THROWAWAY_NONREF_ROOM__', 1000, 2)
  RETURNING id INTO v_room_nonref_id;

  -- 3. Insert bookings (triggers trg_set_booking_cancellation_snapshot)
  INSERT INTO public.bookings (
    tourist_id, room_id, check_in_date, check_out_date,
    guest_count, total_price, downpayment_amount, commission_amount,
    convenience_fee, status, payment_status
  ) VALUES (
    v_test_tourist_id, v_room_std_id, (CURRENT_DATE + 10), (CURRENT_DATE + 12),
    2, 2000, 500, 160, 100, 'pending', 'awaiting_deposit'
  ) RETURNING id, cancellation_policy, cancellation_snapshot
  INTO v_booking_std_id, v_policy_std, v_snapshot_std;

  INSERT INTO public.bookings (
    tourist_id, room_id, check_in_date, check_out_date,
    guest_count, total_price, downpayment_amount, commission_amount,
    convenience_fee, status, payment_status
  ) VALUES (
    v_test_tourist_id, v_room_nonref_id, (CURRENT_DATE + 10), (CURRENT_DATE + 12),
    2, 2000, 500, 160, 100, 'pending', 'awaiting_deposit'
  ) RETURNING id, cancellation_policy
  INTO v_booking_nonref_id, v_policy_nonref;

  -- 4. Assertions
  IF v_policy_std != 'standard' THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Standard property produced policy %', v_policy_std;
  END IF;

  IF v_policy_nonref != 'non_refundable' THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Non-refundable property produced policy %', v_policy_nonref;
  END IF;

  IF v_snapshot_std IS NULL OR (v_snapshot_std->>'policy') != 'standard' THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Standard snapshot invalid: %', v_snapshot_std;
  END IF;

  -- Deliberately raise exception to roll back all inserted records
  RAISE EXCEPTION 'TEST OK: All assertions passed. std_policy=%, nonref_policy=%, snapshot=%', 
    v_policy_std, v_policy_nonref, v_snapshot_std;
END $$;
