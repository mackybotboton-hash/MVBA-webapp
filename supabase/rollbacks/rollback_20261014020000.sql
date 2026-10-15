BEGIN;

-- =============================================================================
-- Rollback: rollback_20261014020000.sql
-- Reverts 20261014020000_drop_stale_booking_rpc_v1overload.sql
-- =============================================================================
-- NOTE: This recreates the stale 11-parameter overload ONLY for rollback
-- purposes. It should not remain in the live database after rollback is complete.
-- The app uses the 12-parameter overload. The 11-parameter overload has no
-- legitimate caller and was itself a bug.

CREATE OR REPLACE FUNCTION public.request_booking_atomic_v2(
  p_tourist_id UUID,
  p_room_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_guest_count INT,
  p_total_price NUMERIC,
  p_downpayment_amount NUMERIC,
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
BEGIN
  RAISE EXCEPTION 'Stale overload: use the 12-parameter version including p_downpayment_percent.';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_booking_atomic_v2(UUID, UUID, DATE, DATE, INT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_booking_atomic_v2(UUID, UUID, DATE, DATE, INT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO service_role;

COMMIT;
