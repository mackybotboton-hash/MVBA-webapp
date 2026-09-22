# MVBA Web Application
### San Agustin & Bretania Eco-Tourism Management System

The MVBA Web Application is a Progressive Web Application (PWA) developed for the San Agustin Resort and Homestay Association in Surigao del Sur, Philippines. The system provides a unified operational platform connecting tourists, accredited homestays, resort operators, and municipal association leadership across the 24-island Bretania archipelago.

---

## Architecture and Technology Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| Framework | Next.js 16 (App Router, React 19) | Server components, server actions, route handlers |
| Language | TypeScript 5 (Strict Mode) | Static typing and end-to-end schema validation |
| Styling | Tailwind CSS v4, Radix UI Primitives | Responsive layouts and design tokens |
| State and Data Fetching | TanStack Query, React Hook Form, Zod | Client state cache, form validation |
| Database and Auth | Supabase (PostgreSQL 15+) | Cookie session auth, Row Level Security, WebSockets |
| Offline and PWA | Serwist (`@serwist/next`) | Service worker offline caching, installable manifest |
| QR Code Generation | `qrcode` (ISO/IEC 18004) | Offline client-side scannable pass generation |
| Notifications | OneSignal SDK and REST API | Browser push notifications for bookings and messages |
| Deployment | Vercel | Production hosting, ISR caching, edge runtime |

---

## Core System Modules

### 1. Tourist Discovery and Reservations
- Accommodation catalog with filtering by category (Beachfront, Island Hopping, Family, Budget, Luxury) and keyword search.
- Date selection with server-side capacity checks and double-booking prevention using atomic PostgreSQL locking (`FOR UPDATE`).
- Server-side price calculation with mandatory 20% downpayment and 8% association commission breakdown.
- GCash proof of payment upload with reference number submission.

### 2. Offline-Ready Digital Boarding Pass
- ISO-standard camera-scannable QR code generated entirely in client memory.
- High-definition 640x1000px branded pass rendered to HTML5 canvas containing booking reference (`MVBA-BRIT-XXXX`), accommodation details, and check-in/out timestamps.
- Native device integration via Web Share API (`navigator.share`), allowing tourists on iOS Safari and Android Chrome to save the pass directly to their Photos / Camera Roll.
- Fallback 1-click PNG image download.
- Automatic caching in browser local storage (`mvba_offline_boarding_passes`) and network status monitoring (`navigator.onLine`) allowing tourists to present valid passes at docks with no cellular reception.

### 3. Homestay and Resort Management
- Daily operational dashboard displaying arrivals, current in-house guests, and departures.
- Built-in camera scanner and reference code lookup for validating guest boarding passes at check-in.
- Room inventory management: capacity, pricing, descriptions, and activation states.
- Resort boat dispatch logging and standard municipal tariff computation for Bretania island-hopping circuits.
- Association dues tracking with direct GCash treasury upload.

### 4. Association Administration and Treasury
- Centralized verification queue for guest GCash downpayment receipts and host payout settlement.
- Accreditation workflows for onboarding new homestays, resorts, and property units.
- Monthly membership dues audit ledger.
- Broadcast system for urgent weather advisories, Coast Guard gale warnings, and municipal notices.
- Real-time two-way messaging between tourists, hosts, and association staff.

---

## Security Model

1. **Edge Proxy Isolation (`src/proxy.ts`)**:
   - Session authentication and role validation executed at the edge prior to page rendering.
   - User roles are resolved strictly from verified database records (`profiles.role`) or server-issued JWT claims.
   - Role state is stored in an `httpOnly`, `secure` cookie (`mvba_user_role`) to prevent client-side script inspection.
   - Non-blocking prefetch handling prevents session cache poisoning.

2. **Row Level Security and Database Triggers (`supabase/migrations/security-hardening.sql`)**:
   - RLS enabled across all database tables.
   - `handle_new_user()` trigger unconditionally defaults public signups to `role = 'tourist'`, preventing self-assigned administrative privileges.
   - `prevent_role_tampering()` trigger blocks modifications to `role` and `is_approved` columns unless executed by authorized administrators or the backend service role.
   - `prevent_booking_financial_tampering()` trigger prohibits non-admin callers from modifying pricing, payment statuses, or payout amounts.
   - `prevent_message_tampering()` trigger guarantees chat message immutability.
   - All trigger functions explicitly specify `SET search_path = public` to mitigate search path vulnerabilities.

3. **PII and File Storage Protection**:
   - Payment receipts stored in private storage buckets.
   - File downloads restricted to temporary signed URLs generated server-side through `createSignedUrl`.
   - Access strictly gated to the reserving tourist, the host of the reserved property, and association administrators.

4. **API Route Protection**:
   - `/api/notify`: Gated behind an `INTERNAL_API_SECRET` Bearer token or authenticated administrator session.
   - `/api/revalidate` and `/api/keep-alive`: Enforce timing-safe secret comparisons using `crypto.timingSafeEqual`.

---

## Directory Structure

```
MVBA-webapp/
├── .github/
│   └── workflows/
│       ├── production.yml          # CI pipeline: TypeScript check, build verification
│       └── supabase-keep-alive.yml # Automated database health trigger
├── public/
│   ├── icons/                      # PWA application icons
│   ├── manifest.json               # Web App Manifest
│   └── OneSignalSDKWorker.js       # Push notification service worker
├── scripts/
│   └── keep-alive.mjs              # Node utility for database keep-alive pings
├── src/
│   ├── app/
│   │   ├── (dashboard)/            # Authenticated role portals
│   │   │   ├── admin/              # Municipal & Association Admin Dashboard
│   │   │   ├── homestay/           # Homestay Operator Dashboard
│   │   │   └── resort/             # Resort Operator Dashboard
│   │   ├── (tourist)/              # Public and guest routes
│   │   │   ├── bookings/           # Reservation ledger and offline pass list
│   │   │   ├── chat/               # Live chat with hosts
│   │   │   ├── explore/            # Bretania travel guide
│   │   │   ├── property/[id]/      # Property listing and booking page
│   │   │   └── page.tsx            # Discovery marketplace homepage
│   │   ├── actions/                # Server Actions (atomic database operations)
│   │   ├── api/                    # Route Handlers (health, notify, revalidate)
│   │   ├── globals.css             # Tailwind v4 theme configuration
│   │   └── proxy.ts                # Next.js Edge proxy middleware
│   ├── components/
│   │   ├── admin/                  # Administrative management components
│   │   ├── layouts/                # Navigation bars and role sidebars
│   │   ├── owner/                  # Host components (RoomForm, QRScanner, DuesModal)
│   │   ├── shared/                 # Chat interface, Logo, Weather banners
│   │   ├── tourist/                # Booking modals, boarding pass dialog, cards
│   │   └── ui/                     # Primitives (dialog, badge, button, form)
│   ├── hooks/
│   │   ├── use-auth.ts             # Session and profile listener
│   │   ├── use-offline-boarding-passes.ts # LocalStorage pass caching and network state
│   │   ├── use-realtime-messages.ts# WebSocket chat subscriptions
│   │   └── use-wishlist.ts         # Tourist favorites manager
│   └── lib/
│       ├── boarding-pass-generator.ts # ISO QR code and Retina canvas engine
│       ├── constants.ts            # Application roles and route constants
│       ├── utils.ts                # Sanitization and class merging helpers
│       ├── supabase/               # Browser, server, and service role clients
│       └── types/
│           └── database.ts         # TypeScript schema mirroring PostgreSQL tables
├── supabase/
│   ├── schema.sql                  # Canonical base schema, RLS, and functions
│   ├── concurrency_booking_fix.sql # Atomic booking locking function
│   └── migrations/                 # Incremental SQL migration scripts
└── next.config.ts                  # Next.js application configuration
```

---

## Environment Variables

Create a `.env.local` file in the project root with the following keys:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# OneSignal Push Notifications
NEXT_PUBLIC_ONESIGNAL_APP_ID=your-onesignal-app-id
ONESIGNAL_REST_API_KEY=your-onesignal-rest-api-key

# Internal API Protection
INTERNAL_API_SECRET=your-random-32-byte-hex-secret
REVALIDATION_SECRET=your-random-32-byte-hex-secret
CRON_SECRET=your-random-32-byte-hex-secret
```

Note: Never prefix `SUPABASE_SERVICE_ROLE_KEY` or API secrets with `NEXT_PUBLIC_`.

---

## Getting Started

### Prerequisites
- Node.js 20.x or later
- npm 10.x or later
- Supabase account with PostgreSQL 15+ instance

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/mackybotboton-hash/MVBA-webapp.git
   cd MVBA-webapp
   ```

2. Install project dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables as outlined above in `.env.local`.

4. Run the database migrations in the Supabase SQL Editor:
   - Execute `supabase/schema.sql`
   - Execute `supabase/concurrency_booking_fix.sql`
   - Execute `supabase/migrations/security-hardening.sql`

5. Start the local development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| `dev` | `next dev` | Starts local Next.js development server |
| `build` | `next build` | Compiles optimized production application with Turbopack |
| `start` | `next start` | Runs production server |
| `lint` | `eslint` | Runs static code analysis across source files |
| `keep-alive` | `node scripts/keep-alive.mjs` | Sends ping to database to prevent instance pausing |

---

## Pre-Push Quality Assurance Protocol

Before submitting pull requests or merging into `main`:

1. Sync upstream changes:
   ```bash
   git fetch origin
   git merge origin/main
   ```
2. Run TypeScript compilation check:
   ```bash
   npx tsc --noEmit
   ```
3. Run linter:
   ```bash
   npm run lint
   ```
4. Verify production compilation:
   ```bash
   npm run build
   ```

---

## Administrative Inquiries and License

This software is developed for the **San Agustin Resort & Homestay Association (MVBA)** and the **Municipal Tourism Office of San Agustin, Surigao del Sur**. Unauthorized redistribution or deployment outside accredited municipal operations is prohibited.

Aurora Alliance 2026
