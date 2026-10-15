BEGIN;

-- =============================================================================
-- Rollback Migration: rollback_20261014000000.sql
-- Description: Reverts 20261014000000_reattach_security_triggers.sql
-- Drops ONLY the triggers attached by the migration and functions newly created.
-- Preserves pre-existing public.prevent_booking_financial_tampering() function.
-- INTENTIONALLY preserves the hardened public.handle_new_user() trigger function.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Profiles: Drop trigger and newly created role tampering function
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_prevent_profile_role_tampering ON public.profiles;
DROP FUNCTION IF EXISTS public.prevent_profile_role_tampering();


-- -----------------------------------------------------------------------------
-- 2. Bookings: Drop ONLY the trigger attached to bookings
-- -----------------------------------------------------------------------------
-- Note: Function public.prevent_booking_financial_tampering() is preserved because
-- it was defined prior to this migration in 20261012000000_cancellation_phase1_schema.sql.
DROP TRIGGER IF EXISTS trg_prevent_booking_financial_tampering ON public.bookings;


-- -----------------------------------------------------------------------------
-- 3. Messages: Drop trigger and newly created function (if present)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_prevent_message_tampering ON public.messages;
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.prevent_message_tampering();


-- -----------------------------------------------------------------------------
-- NOTE ON public.handle_new_user() AND on_auth_user_created:
-- -----------------------------------------------------------------------------
-- The hardened public.handle_new_user() function is INTENTIONALLY NOT reverted
-- to the vulnerable legacy version (which accepted raw_user_meta_data->>'role'
-- directly from clients, allowing unauthorized self-promotion to admin/host).
-- Retaining the hardened trigger ensures all new public signups continue to safely
-- default to 'tourist', while operator accounts are provisioned exclusively via
-- secure administrative workflows using the service_role key.
-- -----------------------------------------------------------------------------

COMMIT;
