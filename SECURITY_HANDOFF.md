# Security Handoff & Master Account Action Items
> **Target Audience**: Lead Developer / Project Owner (Supabase & Vercel Master Account Holder)  
> **Branch**: `feat/security-hardening`  
> **Date**: September 2026  

---

## Executive Summary

During the development of the `feat/security-hardening` branch, the codebase was hardened against unauthorized privilege escalation, server action bypasses, insecure edge proxy routing, and client-side price tampering.

However, **database-level triggers, storage bucket visibility rules, and production secret variables can only be configured by someone with master access** to the Supabase Project Dashboard and Vercel/Production deployment settings.

Below is the step-by-step checklist of security items that must be executed using the master/owner account before or immediately upon merging this branch to `main`.

---

## 1. Supabase SQL Migration (Critical)

In this PR, we prepared a turnkey SQL migration file:
📁 **[`supabase/migrations/security-hardening.sql`](file:///c:/Users/nemsu/Downloads/Private/code/MVBA-webapp/supabase/migrations/security-hardening.sql)**

### Actions Required:
1. Open the **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Navigate to your project → **SQL Editor** → **New Query**.
3. Paste the contents of `supabase/migrations/security-hardening.sql` and click **Run**.

### What this migration does:
- **Enables Row Level Security (RLS)** across all core tables (`profiles`, `bookings`, `dues`, `properties`, `rooms`, `reviews`, `messages`, `announcements`, `audit_logs`).
- **Locks Signups to Tourist Only**: Updates `handle_new_user()` so that even if a malicious user passes `{"role": "admin"}` in their client signup metadata, the database trigger strictly forces `role = 'tourist'` and `is_approved = true`.
- **Prevents Role Tampering via SQL Trigger**: Installs a `BEFORE UPDATE` trigger on `profiles` that forbids modifying `role` or `is_approved` unless the transaction is executed by an authorized admin or the backend service role.
- **Enforces Cancellation-Only Updates for Tourists**: Prevents guests from altering `total_price`, `payment_status`, or room assignment via direct Supabase client queries.
- **Restricts Association Dues**: Allows hosts to upload dues receipts, but only admins can toggle `status = 'paid'`.
- **Host Receipt Visibility**: Permits hosts to view GCash receipts submitted for bookings on their properties.

---

## 2. Designating Initial Admin Accounts (Post-Migration)

Because the database trigger now **completely prevents self-promotion to `admin` or `operator`**, any new administrator accounts must be elevated either via the SQL Editor or an authorized admin action.

### Actions Required:
Run the following SQL query in the Supabase SQL Editor to elevate your master account or association officers:

```sql
-- Replace with your admin account's email
UPDATE public.profiles
SET 
  role = 'admin',
  is_approved = true,
  full_name = 'MVBA System Administrator'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'your-admin-email@example.com'
);
```

---

## 3. Storage Bucket Hardening (GCash Receipts)

GCash receipts contain sensitive Personal Identifiable Information (PII), including account names, mobile phone numbers, downpayment amounts, and GCash transaction reference IDs.

Currently, if the `payment-receipts` bucket is marked as **Public**, anyone who guesses or scrapes the file URL can view tourist payment screenshots.

### Actions Required:
1. Go to **Supabase Dashboard** → **Storage** → **Buckets**.
2. Locate the bucket: **`payment-receipts`** (and `receipts` if previously created).
3. Click the three dots (`...`) next to the bucket → **Edit bucket**:
   - **Toggle OFF "Public Bucket"** (Make it Private).
4. Navigate to **Storage** → **Policies** and verify the following policies exist for `payment-receipts`:
   - **Upload Policy**: Authenticated users can upload to their own folder (`auth.uid()::text || '/*'`).
   - **Select/Download Policy**: Only the tourist who uploaded the receipt, the host of the reserved property, and association admins can read files.

> [!NOTE]
> The codebase in `feat/security-hardening` has already been updated in `src/lib/supabase/storage.ts` to use `createSignedUrl` (with temporary expiration) so private bucket receipts load seamlessly in admin and host review modals without being publicly accessible to the open internet.

---

## 4. Production Environment Secrets (Vercel & Supabase)

Several server-side features depend on environment variables that must be configured in your production environment (e.g. Vercel Project Settings → Environment Variables):

### Variables to Verify / Add:

| Environment Variable | Description | Recommended Value / Action |
| :--- | :--- | :--- |
| `INTERNAL_API_SECRET` | Protects the `/api/notify` endpoint from unauthorized external spam. | Generate a 32+ character random hex string (e.g. `openssl rand -hex 32`). |
| `REVALIDATION_SECRET` | Protects the on-demand ISR purge route `/api/revalidate`. | Generate a 32+ character random hex string (do NOT use a hardcoded default). |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend admin key used by server actions for elevated mutations. | Ensure this key is **NEVER** prefixed with `NEXT_PUBLIC_` and never committed to version control. |
| `ONESIGNAL_REST_API_KEY` | Server key for sending OneSignal push notifications. | Keep restricted to server-side runtime only. |

### Secret Rotation Recommendation:
If `SUPABASE_SERVICE_ROLE_KEY` or database connection strings were previously pasted into local test scripts or shared across team chat, please navigate to **Supabase Dashboard** → **Project Settings** → **API** and click **Generate new secret** for the `service_role` key, then update your production hosting provider.

---

## 5. Supabase Auth Configuration (Dashboard Settings)

In the **Supabase Dashboard** → **Authentication**:

1. **Email Confirmation**:
   - Path: **Auth** → **Providers** → **Email**.
   - Recommendation: Enable **"Confirm email"** before production launch to prevent bots from generating phantom tourist bookings or spamming host listings.
2. **Rate Limits**:
   - Path: **Auth** → **Rate Limits**.
   - Ensure rate limits on `/auth/v1/signup`, `/auth/v1/token`, and `/auth/v1/recover` are enabled with default or stricter thresholds to mitigate credential stuffing.

---

## 6. Realtime Replication Verification

Ensure that the required tables are published to Supabase Realtime so live chat and booking status notifications work smoothly:

1. In the Supabase SQL Editor, verify or run:
```sql
-- Ensure messages and bookings broadcast realtime changes to authorized subscribers
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
```

---

## Verification & Sanity Checklist

Before declaring production ready:
- [ ] `supabase/migrations/security-hardening.sql` executed in Supabase SQL Editor without errors.
- [ ] At least one account has been manually verified with `role = 'admin'` and `is_approved = true`.
- [ ] `payment-receipts` bucket is set to **Private** in Supabase Storage.
- [ ] `INTERNAL_API_SECRET` and `REVALIDATION_SECRET` set in Vercel environment variables.
- [ ] Verified that visiting `/admin` while logged in as a normal tourist redirects to `/` or shows access denied.
- [ ] Verified that creating a booking calculates pricing securely from the database rather than trusting client payloads.
