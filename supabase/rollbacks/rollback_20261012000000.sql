BEGIN;

-- =============================================================================
-- Rollback Migration: rollback_20261012000000.sql
-- Description: Reverts 20261012000000_cancellation_phase1_schema.sql
-- =============================================================================

-- 1. Drop trigger and function
DROP TRIGGER IF EXISTS trg_set_booking_cancellation_snapshot ON public.bookings;
DROP FUNCTION IF EXISTS public.set_booking_cancellation_snapshot();

-- 2. Drop constraints from bookings, system_settings, properties
ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS check_bookings_cancellation_policy,
DROP CONSTRAINT IF EXISTS check_bookings_cancelled_by,
DROP CONSTRAINT IF EXISTS check_bookings_host_refund_status,
DROP CONSTRAINT IF EXISTS check_bookings_panaw_refund_status;

ALTER TABLE public.system_settings
DROP CONSTRAINT IF EXISTS check_system_settings_fee_rule,
DROP CONSTRAINT IF EXISTS check_system_settings_partial_percent,
DROP CONSTRAINT IF EXISTS check_system_settings_days,
DROP CONSTRAINT IF EXISTS check_system_settings_deadline;

ALTER TABLE public.properties
DROP CONSTRAINT IF EXISTS check_properties_cancellation_policy;

-- 3. Drop columns from bookings
ALTER TABLE public.bookings
DROP COLUMN IF EXISTS cancelled_by,
DROP COLUMN IF EXISTS cancelled_at,
DROP COLUMN IF EXISTS cancellation_reason,
DROP COLUMN IF EXISTS cancellation_policy,
DROP COLUMN IF EXISTS cancellation_snapshot,
DROP COLUMN IF EXISTS policy_accepted_at,
DROP COLUMN IF EXISTS cancel_acknowledged_at,
DROP COLUMN IF EXISTS refund_total,
DROP COLUMN IF EXISTS deposit_refund_amount,
DROP COLUMN IF EXISTS fee_refund_amount,
DROP COLUMN IF EXISTS adjusted_host_payout_amount,
DROP COLUMN IF EXISTS refund_gcash_number,
DROP COLUMN IF EXISTS host_refund_amount,
DROP COLUMN IF EXISTS host_refund_status,
DROP COLUMN IF EXISTS host_refund_receipt_url,
DROP COLUMN IF EXISTS host_refund_due_at,
DROP COLUMN IF EXISTS host_refund_sent_at,
DROP COLUMN IF EXISTS panaw_refund_amount,
DROP COLUMN IF EXISTS panaw_refund_status,
DROP COLUMN IF EXISTS panaw_refund_receipt_url,
DROP COLUMN IF EXISTS panaw_refund_sent_at,
DROP COLUMN IF EXISTS refund_issue_reported_at,
DROP COLUMN IF EXISTS refund_issue_reason,
DROP COLUMN IF EXISTS refunded_at;

-- 4. Drop columns from system_settings
ALTER TABLE public.system_settings
DROP COLUMN IF EXISTS refund_full_days,
DROP COLUMN IF EXISTS refund_partial_days,
DROP COLUMN IF EXISTS refund_partial_percent,
DROP COLUMN IF EXISTS convenience_fee_refund_rule,
DROP COLUMN IF EXISTS host_refund_deadline_hours;

-- 5. Drop column from properties
ALTER TABLE public.properties
DROP COLUMN IF EXISTS cancellation_policy;

-- 6. Note: To rollback public.prevent_booking_financial_tampering(), 
-- re-run your live definition from pg_get_functiondef.

COMMIT;
