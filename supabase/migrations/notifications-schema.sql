-- ==============================================================================
-- MVBA PWA: Real-Time Notification System Schema
-- ==============================================================================
-- This migration does three things:
-- 1. Creates the `notifications` table (persistent in-app inbox)
-- 2. Denormalizes `owner_id` onto `bookings` so Supabase Realtime can
--    filter subscriptions without joins (Realtime cannot traverse relations)
-- 3. Adds `seen_by_host_at` to `bookings` to drive badge count logic
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: Denormalize owner_id onto bookings
-- ------------------------------------------------------------------------------
-- Supabase Realtime's row-level filter (e.g. owner_id=eq.{userId}) requires the
-- column to exist directly on the table. We cannot filter on a joined column.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Backfill existing rows from the rooms → properties → owner_id chain
UPDATE public.bookings b
SET owner_id = p.owner_id
FROM public.rooms r
JOIN public.properties p ON p.id = r.property_id
WHERE b.room_id = r.id
  AND b.owner_id IS NULL;

-- Create an index so Realtime and badge-count queries are fast
CREATE INDEX IF NOT EXISTS idx_bookings_owner_id ON public.bookings(owner_id);

-- ------------------------------------------------------------------------------
-- STEP 2: Add seen_by_host_at for explicit badge-count tracking
-- ------------------------------------------------------------------------------
-- NULL means the host has not yet opened their Bookings page since this booking
-- arrived. The badge clears when the host navigates to /bookings, which writes
-- the current timestamp. This is the "explicit seen" approach.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS seen_by_host_at TIMESTAMPTZ;

-- Index to make the "WHERE seen_by_host_at IS NULL" query fast
CREATE INDEX IF NOT EXISTS idx_bookings_unseen ON public.bookings(owner_id, seen_by_host_at)
  WHERE seen_by_host_at IS NULL;

-- ------------------------------------------------------------------------------
-- STEP 3: Create the notifications table (persistent in-app inbox)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,   -- 'new_booking' | 'booking_status' | 'new_message' | 'deposit_verified' | 'booking_cancelled'
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  url         TEXT,                   -- deep-link path (e.g. '/resort/bookings')
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient per-user notification queries and Realtime filtering
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read)
  WHERE is_read = false;

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can mark their own notifications as read (UPDATE is_read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Only the service role (server actions) can INSERT notifications
-- The service role bypasses RLS entirely, so no explicit INSERT policy is needed
-- for the server. We block direct client inserts for security.
CREATE POLICY "Block direct client inserts"
  ON public.notifications FOR INSERT
  WITH CHECK (false);

-- ------------------------------------------------------------------------------
-- STEP 4: RLS policies for the new bookings columns
-- ------------------------------------------------------------------------------
-- The existing SELECT/UPDATE policies already cover owner-side access correctly
-- (via the join-based policies in tenant-isolation.sql).
-- We add a targeted policy for the owner to UPDATE seen_by_host_at via client.
CREATE POLICY "Strict_Tenant_Owner_MarkSeen_Bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = owner_id);

-- ------------------------------------------------------------------------------
-- STEP 5: Enable Supabase Realtime on both tables
-- ------------------------------------------------------------------------------
-- These commands add the tables to the supabase_realtime publication so
-- postgres_changes events fire for INSERT/UPDATE operations.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
