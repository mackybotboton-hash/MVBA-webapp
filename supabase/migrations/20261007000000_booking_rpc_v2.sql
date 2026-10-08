-- ============================================================
-- Phase 1a: Secure Server-Side Atomic Booking RPC (v2)
-- ============================================================

CREATE OR REPLACE FUNCTION public.request_booking_atomic_v2(
  p_tourist_id UUID,
  p_room_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_guest_count INT,
  p_total_price NUMERIC,
  p_downpayment_amount NUMERIC,
  p_downpayment_percent INT,
  p_commission_amount NUMERIC,
  p_host_payout_amount NUMERIC,
  p_convenience_fee NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  v_room_capacity INT;
  v_conflict_id UUID;
  v_conflict_check_in DATE;
  v_conflict_check_out DATE;
  v_conflict_status booking_status;
  v_new_booking_id UUID;
BEGIN
  -- A. Validation: Check dates
  IF p_check_in >= p_check_out THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_DATES',
      'message', 'Check-out date must be after check-in date'
    );
  END IF;

  IF p_check_in < CURRENT_DATE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'PAST_DATE',
      'message', 'Check-in date cannot be in the past'
    );
  END IF;

  -- B. Row-Level Lock (FOR UPDATE)
  SELECT rooms.max_capacity INTO v_room_capacity
  FROM rooms
  WHERE rooms.id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ROOM_NOT_FOUND',
      'message', 'Room not found'
    );
  END IF;

  IF p_guest_count > v_room_capacity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CAPACITY_EXCEEDED',
      'message', format('Guest count exceeds room maximum capacity of %s', v_room_capacity)
    );
  END IF;

  -- C. Atomic Overlap Detection
  SELECT bookings.id, bookings.check_in_date, bookings.check_out_date, bookings.status
  INTO v_conflict_id, v_conflict_check_in, v_conflict_check_out, v_conflict_status
  FROM bookings
  WHERE bookings.room_id = p_room_id
    AND bookings.status IN ('accepted', 'pending', 'completed')
    AND bookings.check_in_date < p_check_out
    AND bookings.check_out_date > p_check_in
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'DATE_CONFLICT',
      'message', format('Room is already reserved from %s to %s (%s)', v_conflict_check_in, v_conflict_check_out, v_conflict_status),
      'conflict', jsonb_build_object(
        'id', v_conflict_id,
        'check_in', v_conflict_check_in,
        'check_out', v_conflict_check_out,
        'status', v_conflict_status
      )
    );
  END IF;

  -- D. Insert Confirmed Booking Record
  INSERT INTO bookings (
    tourist_id,
    room_id,
    check_in_date,
    check_out_date,
    guest_count,
    total_price,
    downpayment_amount,
    downpayment_percent,
    commission_amount,
    host_payout_amount,
    convenience_fee,
    status,
    payment_status,
    notes
  ) VALUES (
    p_tourist_id,
    p_room_id,
    p_check_in,
    p_check_out,
    p_guest_count,
    p_total_price,
    p_downpayment_amount,
    p_downpayment_percent,
    p_commission_amount,
    p_host_payout_amount,
    p_convenience_fee,
    'pending',
    'awaiting_deposit',
    p_notes
  )
  RETURNING bookings.id INTO v_new_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_new_booking_id,
    'message', 'Reservation request created successfully'
  );
END;
$$;

-- Restrict execution to service_role ONLY
REVOKE EXECUTE ON FUNCTION public.request_booking_atomic_v2(UUID, UUID, DATE, DATE, INT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_booking_atomic_v2(UUID, UUID, DATE, DATE, INT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_booking_atomic_v2(UUID, UUID, DATE, DATE, INT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.request_booking_atomic_v2(UUID, UUID, DATE, DATE, INT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO service_role;
