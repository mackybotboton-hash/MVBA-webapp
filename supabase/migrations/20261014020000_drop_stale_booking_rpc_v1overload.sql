BEGIN;

-- =============================================================================
-- Migration: 20261014020000_drop_stale_booking_rpc_v1overload.sql
-- Description: Drops the stale 11-parameter overload of request_booking_atomic_v2.
--
-- Background:
--   When p_downpayment_percent (INT) was added to request_booking_atomic_v2,
--   the REVOKE/GRANT lines in 20261007000000_booking_rpc_v2.sql still referenced
--   the old 11-parameter signature. This caused Postgres to create TWO overloads
--   instead of replacing the one function. The 11-param overload is never called
--   by the app (the app passes all 12 parameters including p_downpayment_percent).
--
-- Live signature confirmed via:
--   select p.oid::regprocedure from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'request_booking_atomic_v2';
--   → request_booking_atomic_v2(uuid,uuid,date,date,integer,numeric,numeric,numeric,numeric,numeric,text)   ← stale, DROP this
--   → request_booking_atomic_v2(uuid,uuid,date,date,integer,numeric,numeric,integer,numeric,numeric,numeric,text) ← current, keep this
--
-- This DROP uses the confirmed exact type signature.
-- =============================================================================

DROP FUNCTION IF EXISTS public.request_booking_atomic_v2(
  UUID,   -- p_tourist_id
  UUID,   -- p_room_id
  DATE,   -- p_check_in
  DATE,   -- p_check_out
  INT,    -- p_guest_count
  NUMERIC, -- p_total_price
  NUMERIC, -- p_downpayment_amount
  NUMERIC, -- p_commission_amount         ← 8th param is NUMERIC in old overload (no p_downpayment_percent INT)
  NUMERIC, -- p_host_payout_amount
  NUMERIC, -- p_convenience_fee
  TEXT    -- p_notes
);

COMMIT;
