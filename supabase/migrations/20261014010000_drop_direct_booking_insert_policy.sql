BEGIN;

-- =============================================================================
-- Migration: 20261014010000_drop_direct_booking_insert_policy.sql
-- Description: Drop direct client-side INSERT policy on public.bookings.
-- Closes direct API insertion vulnerability and ensures all bookings are created
-- exclusively via the atomic, validating RPC request_booking_atomic_v2.
-- Idempotent, safe execution.
-- =============================================================================

-- Drop live direct INSERT policy
DROP POLICY IF EXISTS "Tourists can create bookings" ON public.bookings;

-- Defensive drops for potential naming variations
DROP POLICY IF EXISTS "Strict_Tenant_Tourist_Insert_Bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can insert own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.bookings;

COMMIT;
