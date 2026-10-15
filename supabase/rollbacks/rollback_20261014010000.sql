BEGIN;

-- =============================================================================
-- Rollback Migration: rollback_20261014010000.sql
-- Description: Reverts 20261014010000_drop_direct_booking_insert_policy.sql
-- Recreates the dropped direct INSERT policy on public.bookings exactly as it was live.
-- =============================================================================

DROP POLICY IF EXISTS "Tourists can create bookings" ON public.bookings;

CREATE POLICY "Tourists can create bookings"
  ON public.bookings
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = tourist_id);

COMMIT;
