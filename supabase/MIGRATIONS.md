# Supabase Migrations Registry

| Migration File | Description | Applied Manually in Supabase? (yes/no/unknown) |
| :--- | :--- | :--- |
| `20240530000001_system_hotlines_schema.sql` | Creates `system_hotlines` emergency contact table, RLS policies, and seeds initial emergency hotlines. | unknown |
| `20240530000002_explore_islands_schema.sql` | Creates `explore_islands` table, RLS policies, and seeds default Britania Islands destination data. | unknown |
| `20240530000003_storage_images_bucket.sql` | Creates public `images` storage bucket and configures public read / authenticated upload storage policies. | unknown |
| `20260926000000_monetization.sql` | Adds platform `convenience_fee` to `system_settings` and `service_fee` tracking column to `bookings`. | unknown |
| `20260926000001_rename_messenger_to_tiktok.sql` | Renames social link column `messenger_url` to `tiktok_url` on `properties` table. | unknown |
| `20260926054104_add_addon_commission_setting.sql` | Adds `addon_commission_percentage` (default 8.0, 0-100 check) to `system_settings`. | unknown |
| `20261007000000_booking_rpc_v2.sql` | Creates atomic reservation RPC `request_booking_atomic_v2` and tamper-proofing financial trigger. | unknown |
| `20261008000000_configurable_downpayment.sql` | Adds host-configurable `downpayment_percentage` to `properties`/`rooms` and `min_downpayment_percentage` to `system_settings`. | unknown |
| `20261008094744_fix_booking_owner_id.sql` | Updates `request_booking_atomic_v2` RPC to reliably populate `owner_id` from property records. | unknown |
| `20261009000000_phase1c_cleanup_policies.sql` | Cleans up legacy booking RLS insert policies to enforce booking creation solely via atomic RPC. | unknown |
| `20261011000000_add_deposit_payout_amount.sql` | Adds `deposit_payout_amount` to `bookings` and updates `prevent_booking_financial_tampering` trigger. | unknown |
| `20261012000000_cancellation_phase1_schema.sql` | Implements Cancellation Phase 1 schema (property policy tiers, booking cancellation snapshot JSONB, cancellation audit fields, and refund settings). | unknown |
| `add_social_links.sql` | Adds `facebook_url`, `instagram_url`, and `messenger_url` social profile link columns to `properties`. | unknown |
| `audit-schema.sql` | Adds audit verification columns (`verified_by`, `verified_at`, `payout_recorded_by`, `payout_recorded_at`) to `bookings`. | unknown |
| `calendar-events-schema.sql` | Creates `calendar_events` table for property owners to record manual/external bookings and block calendar dates. | unknown |
| `explore-and-settings.sql` | Creates initial `explore_islands` table and early `system_settings` table with commission rates. | unknown |
| `extra-services-schema.sql` | Creates `extra_services` and `booking_addons` tables for property add-on amenities with RLS policies. | unknown |
| `fix-rls.sql` | Drops recursive admin profile policy to resolve infinite recursion in `profiles` RLS. | unknown |
| `notifications-schema.sql` | Creates `notifications` table, delivery status indexes, and automated notification triggers. | unknown |
| `onesignal-id.sql` | Adds `onesignal_id` column to `profiles` for Web Push notification dispatch. | unknown |
| `ratings-trigger.sql` | Adds cached `rating` and `review_count` columns to `properties` with automatic aggregation triggers. | unknown |
| `security-hardening.sql` | Implements zero-trust RLS hardening across profiles, properties, and system-level administrative entities. | unknown |
| `settings-schema.sql` | Adds GCash payout (`payout_gcash_number`, `payout_account_name`) and notification preference fields to `profiles`. | unknown |
| `system-settings-schema.sql` | Creates `system_settings` singleton table with platform fee and commission settings. | unknown |
| `tenant-isolation.sql` | Implements tenant isolation RLS policies across properties, rooms, and bookings. | unknown |
