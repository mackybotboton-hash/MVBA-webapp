BEGIN;

-- =============================================================================
-- Rollback Migration: rollback_20261013000000_phase2.sql
-- Description: Reverts 20261013000000_cancellation_phase2_engine.sql
-- Strictly drops ONLY Phase 2 functions. Leaves Phase 1 schema, triggers, and
-- columns completely intact.
-- =============================================================================

-- 1. Drop cancel_booking_atomic RPC
DROP FUNCTION IF EXISTS public.cancel_booking_atomic(uuid, text, boolean, text);

-- 2. Drop estimate_cancellation_refund RPC
DROP FUNCTION IF EXISTS public.estimate_cancellation_refund(uuid);

-- 3. Drop internal compute_cancellation_refund calculator function
DROP FUNCTION IF EXISTS public.compute_cancellation_refund(uuid, text, boolean);

COMMIT;
