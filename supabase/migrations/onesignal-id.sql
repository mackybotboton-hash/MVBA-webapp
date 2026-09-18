-- ============================================================
-- Add OneSignal ID to profiles for Web Push Notification targeting
-- ============================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onesignal_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_onesignal ON profiles(onesignal_id);
