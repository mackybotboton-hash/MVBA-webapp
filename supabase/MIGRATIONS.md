# Supabase Migrations Registry

| Migration File | Description | Applied Manually in Supabase? (yes/no/unknown) |
| :--- | :--- | :--- |
| `20240530000001_system_hotlines_schema.sql` | Creates `system_hotlines` table, enables RLS with public read / admin manage policies, and inserts 4 emergency hotline contacts. | unknown |
| `20240530000002_explore_islands_schema.sql` | Creates `explore_islands` table, enables RLS with public read / admin manage policies, and inserts 4 island destination rows. | unknown |
| `20240530000003_storage_images_bucket.sql` | Inserts public `images` bucket into `storage.buckets` and creates storage RLS policies for public view and authenticated owner upload/delete. | unknown |
| `20260926000000_monetization.sql` | Adds `convenience_fee` to `system_settings`, `convenience_fee` to `bookings`, `commission_rate` to `extra_services`, and `commission_amount` to `booking_addons`. | unknown |
| `20260926000001_rename_messenger_to_tiktok.sql` | Renames column `messenger_url` to `tiktok_url` on `properties` table. | unknown |
| `20260926054104_add_addon_commission_setting.sql` | Adds `addon_commission_percentage NUMERIC DEFAULT 8.0` to `system_settings` with an idempotent CHECK constraint (0 to 100). | unknown |
| `20261007000000_booking_rpc_v2.sql` | Creates atomic reservation RPC `request_booking_atomic_v2` with capacity checks, date-overlap validation, and row locking. REVOKE/GRANT lines corrected to 12-param signature (INT for `p_downpayment_percent`). | unknown |
| `20261008000000_configurable_downpayment.sql` | Adds `downpayment_percent` (1-100) to `properties` and `rooms`, and adds `min_downpayment_percent` and `default_downpayment_percent` to `system_settings`. | unknown |
| `20261008094744_fix_booking_owner_id.sql` | Creates `set_booking_owner_id()` trigger function and BEFORE INSERT trigger on `bookings` to populate `owner_id` from property. | unknown |
| `20261009000000_phase1c_cleanup_policies.sql` | Drops direct INSERT RLS policies on `bookings` to enforce booking creation solely through atomic RPC. | unknown |
| `20261011000000_add_deposit_payout_amount.sql` | Adds `deposit_payout_amount` to `bookings` and updates `prevent_booking_financial_tampering()` trigger function to protect it. | unknown |
| `20261012000000_cancellation_phase1_schema.sql` | Adds `cancellation_policy` to `properties`, refund parameters to `system_settings`, cancellation tracking columns to `bookings`, `set_booking_cancellation_snapshot()` trigger, and tampering guards. | unknown |
| `20261013000000_cancellation_phase2_engine.sql` | Creates `compute_cancellation_refund` (STABLE calculator), `estimate_cancellation_refund` (preview RPC), and `cancel_booking_atomic` (freeze RPC) with updated Money Rules. | applied: yes |
| `20261014000000_reattach_security_triggers.sql` | Hardens `public.handle_new_user()` to enforce role 'tourist' on signup (ignoring client metadata), reattaches `prevent_profile_role_tampering()` on `profiles`, attaches `trg_prevent_booking_financial_tampering` to `bookings`, and attaches `prevent_message_tampering()` on `messages` if present. | applied: yes |
| `20261014010000_drop_direct_booking_insert_policy.sql` | Drops direct INSERT policy "Tourists can create bookings" on `public.bookings`, enforcing all booking creation through `request_booking_atomic_v2`. | applied: yes |
| `20261014020000_drop_stale_booking_rpc_v1overload.sql` | Drops the stale 11-parameter overload of `request_booking_atomic_v2` that was created when `p_downpayment_percent` was added but the old REVOKE/GRANT lines used the wrong signature. | applied: yes |
| `add_social_links.sql` | Adds `facebook_url` and `messenger_url` TEXT columns to `properties`. | unknown |
| `audit-schema.sql` | Adds `verified_by UUID` and `verified_at TIMESTAMPTZ` audit columns to `bookings`. | unknown |
| `calendar-events-schema.sql` | Creates `calendar_events` table for owner manual bookings / date blocks with RLS owner CRUD policies. | unknown |
| `explore-and-settings.sql` | Creates `explore_islands` table with feature arrays and creates singleton `system_settings` table with commission and GCash settings. | unknown |
| `extra-services-schema.sql` | Creates `extra_services` and `booking_addons` tables with service types, prices, commission rates, and RLS policies. | unknown |
| `fix-rls.sql` | Drops recursive policy `"Admins can view all profiles"` on `public.profiles`. | unknown |
| `notifications-schema.sql` | Creates `notifications` table, delivery status indexes, and `notify_booking_event()` trigger function on `bookings`. | unknown |
| `onesignal-id.sql` | Adds `onesignal_id` TEXT column and index to `profiles`. | unknown |
| `ratings-trigger.sql` | Adds `rating` and `reviews_count` columns to `properties` and creates `update_property_rating()` trigger function on `reviews`. | unknown |
| `security-hardening.sql` | Adds zero-trust RLS hardening across profiles, properties, rooms, bookings, and creates `prevent_booking_financial_tampering()` trigger function. | unknown |
| `settings-schema.sql` | Adds `payout_gcash_number`, `push_enabled`, and `onesignal_id` columns to `profiles`, updating admin SELECT policies. | unknown |
| `system-settings-schema.sql` | Creates singleton `system_settings` table (`id INT PRIMARY KEY CHECK (id = 1)`) with commission and fee defaults. | unknown |
| `tenant-isolation.sql` | Enables `btree_gist` extension, adds date range exclusion constraints on `bookings`, and creates tenant-isolated RLS policies. | unknown |
