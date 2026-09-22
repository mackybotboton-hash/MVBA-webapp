# MVBA Web Application
### San Agustin & Bretania Eco-Tourism Management System

The MVBA Web Application is an enterprise Progressive Web Application (PWA) built for the San Agustin Resort and Homestay Association in Surigao del Sur, Philippines. The system serves as the single digital operating platform connecting tourists, accredited homestays, resort operators, and municipal association administrators across the 24-island Bretania archipelago.

---

## What the Platform Can Do

The platform delivers specialized, role-tailored workflows for four key user groups:

```
                               ┌───────────────────────────────────────────────┐
                               │           MVBA Municipal Platform             │
                               └──────────────────────┬────────────────────────┘
                                                      │
         ┌─────────────────────────┬──────────────────┴──────────────┬─────────────────────────┐
         │                         │                                 │                         │
         ▼                         ▼                                 ▼                         ▼
   [Tourists]              [Homestay Hosts]                  [Resort Operators]            [Admin & Tourism]
• Stay Marketplace       • "Today" Arrivals Hub            • Interactive Calendar Grid   • Municipal Capacity
• Atomic Booking Engine  • QR Code Check-in Scanner        • Boat Dispatch Manifests     • Host Accreditation
• GCash Downpayment      • Booking Request Workflow        • 4-Island Tariff Calculator  • GCash Treasury Audit
• Offline Boarding Pass  • Room & Rate Management          • Custom Add-on Packages      • 8% Commission Payouts
• 24 Islands Guide       • Association Dues Tracker        • Occupancy & Revenue KPIs    • Gale Warning Advisories
• Host Live Chat         • Direct Guest Messaging          • Multi-unit Inventory        • Content Management
```

---

## 1. Tourist Experience (Guest Portal)

The tourist portal provides visitors with a comprehensive booking and travel utility designed for mobile and desktop devices.

### Stay Discovery & Accommodation Marketplace
- **Multi-Factor Search & Filtering**: Discover accredited properties across Bretania using category filters (Beachfront, Island Hopping, Family, Budget, Luxury) or keyword search.
- **Rich Media Property Profiles**: Browse high-resolution room photos, host video reels, interactive location maps, verified amenity badges, and check-in/out schedules.
- **Direct Host Connections**: View host profiles, direct phone contacts, and quick links to verified Facebook pages and Messenger chats.
- **Verified Guest Reviews**: Read authentic 1-to-5 star ratings and reviews submitted by confirmed tourists who completed stays.

### High-Concurrency Booking Engine
- **Interactive Room Selection**: Choose room types with transparent guest capacity limits and pricing.
- **Date Range Calendar**: Select stay dates with instant visual highlighting of unavailable dates.
- **Double-Booking Prevention**: Database-level atomic locking (`FOR UPDATE`) guarantees that two guests cannot book the same room for overlapping dates simultaneously.
- **Transparent Price Breakdown**: Real-time server-side quotation showing nightly rate, duration, optional add-on amenities, required 20% downpayment, and remaining balance due upon check-in.

### GCash Downpayment & Payment Verification
- **Official Association GCash QR**: View official association GCash credentials and QR codes for secure downpayment transfers.
- **Receipt Submission**: Submit GCash transaction reference numbers and upload payment screenshots directly through the web portal.
- **Status Lifecycle Tracker**: Real-time visibility into booking progression (`awaiting_deposit`, `deposit_uploaded`, `verified`, `completed`, `cancelled`).

### Offline-Ready Digital Boarding Pass
- **Camera-Scannable ISO QR Code**: Client-side ISO/IEC 18004 QR code generated offline in device memory matching municipal host scanners (`MVBA-BRIT-XXXX`).
- **High-Definition Ticket Canvas**: Renders a 640x1000px branded boarding pass with booking codes, room stay details, guest counts, and verification seals.
- **1-Tap Save to Photos**: Integrated Web Share API (`navigator.share`) allows tourists on iOS Safari and Android Chrome to save their pass directly to their Photos / Camera Roll.
- **Instant PNG Download**: Downloadable image file fallback for offline archiving and printing.
- **Zero-Signal Offline Caching**: Confirmed boarding passes are automatically cached in device local storage, enabling tourists to present valid QR passes at boat docks and islands with no cellular coverage.

### Bretania 24 Islands Travel Guide (`/explore`)
- **Curated Island Guides**: Explore dedicated profiles for prominent destinations in Lianga Bay, including Boslon Island, Hagonoy Island, Naked Island, and Busay Falls.
- **Island-Hopping Tips**: Essential guidelines on low/high tide navigation, protected marine sanctuaries, and photography spots.
- **Municipal Helpline Directory**: Direct access to local police, Coast Guard stations, medical emergency lines, and tourism officers.

### Tourist Utilities
- **My Reservations Hub (`/bookings`)**: Manage upcoming and completed stays with status-segmented tabs (All, Pending, Awaiting Deposit, Completed, Cancelled, and Offline Passes).
- **Saved Favorites (`/wishlist`)**: Save preferred homestays and resorts locally across browsing sessions.
- **Realtime Host Chat (`/chat`)**: Two-way messaging with property owners to coordinate arrival times, boat transfers, and special requests.

---

## 2. Homestay Host Operations (`/homestay`)

Tailored for family-run homestays and local accommodation hosts to manage daily guest turnover efficiently.

- **"Today" Operational Dashboard**: Immediate operational view displaying arriving guests, current in-house occupants, and scheduled departures for the day.
- **QR Code Check-in Scanner**: Integrated camera scanner and manual reference input allowing hosts to verify arriving tourist boarding passes in seconds.
- **Reservation Workflow**: Review incoming booking requests, inspect guest counts, check stay duration, and accept or decline reservations with instant guest push notifications.
- **Room Inventory & Rates**: Add and edit room units, set base prices, configure maximum guest capacity, upload room photos, and toggle active listing status.
- **House Rules Configuration**: Set property policies including check-in/out hours, smoking rules, pet allowances, quiet hours, and custom host instructions.
- **Association Dues Portal**: View monthly association dues standing, obtain municipal payment details, upload payment receipts, and maintain accreditation compliance.
- **Guest Communication Channel**: Messaging system to communicate directly with incoming guests and coordinate arrivals.

---

## 3. Resort Operator Management (`/resort`)

Engineered for larger multi-room resorts, beachfront complexes, and commercial boat tour operators.

- **Interactive Room Availability Grid (`/resort/calendar`)**: Visual multi-room calendar grid showing daily reservations, occupied nights, and vacancies across all resort units.
- **Maritime Boat Dispatch Log (`/resort/dispatch`)**: Comprehensive vessel manifest system tracking boat names, licensed captains, passenger counts, departure/return times, and compliance with Philippine Coast Guard regulations.
- **Regulated Boat Tariff Calculator**: Calculates standard municipal tariffs for the Bretania 4-Island Circuit based on official rate matrices, passenger tiers, and environmental fees.
- **Custom Add-on Services Catalog (`/resort/services`)**: Create and manage extra offerings such as private island-hopping boat hires, beachfront dining, bonfire packages, and equipment rentals.
- **Occupancy & Revenue Analytics**: Business intelligence dashboard providing total booking volume, occupancy trends, gross receipts, and net host payouts.
- **Review Management**: Monitor, review, and evaluate guest feedback to maintain hospitality quality.

---

## 4. Association Administration & Municipal Governance (`/admin`)

Designed for the leadership of the San Agustin Resort and Homestay Association (MVBA) and the Municipal Tourism Office.

- **Municipal Capacity Oversight**: Executive dashboard monitoring aggregate tourist influx, occupancy density, and booking activity across the municipality.
- **Host & Property Accreditation Queue (`/admin/properties`)**: Review and approve new homestay registrations, resort listings, and room additions before they appear in public search results.
- **Financial Clearinghouse (`/admin/transactions`)**:
  - Audit and verify tourist GCash downpayments with side-by-side receipt screenshot inspection.
  - Automatic computation and tracking of the 8% municipal/association commission fee.
  - Track host payouts and settle disbursements with complete financial audit logging.
- **Monthly Dues Audit Ledger (`/admin/dues`)**: Track membership dues compliance across all accredited operators with receipt validation and treasury reconciliation.
- **Emergency Weather & Advisory Broadcasts (`/admin/announcements`)**: Broadcast urgent municipal circulars, Coast Guard sea gale warnings, and safety alerts directly to tourists and operators via push notifications and dashboard banners.
- **Explore Content Management (`/admin/content`)**: Dynamically update the 24 Islands travel guide, add new island features, and update municipal emergency helpline numbers in real time.
- **User Management (`/admin/users`)**: Create and manage operator accounts, assign roles (`admin`, `homestay`, `resort`), and verify host credentials.

---

## 5. Progressive Web App (PWA) & Offline Architecture

- **Installable Native Experience**: Installable as a standalone app on iOS Safari, Android Chrome, and Desktop with full home screen icon integration.
- **Service Worker Caching**: Utilizes Serwist (`@serwist/next`) with optimized caching strategies for static assets, styles, and core shells.
- **Zero-Connection Pass Presentation**: Even during maritime transit or on remote islands with zero network connectivity, tourists can launch the PWA, access their confirmed passes, and display scannable QR codes.
- **Web Push Notifications**: Integrated with OneSignal to deliver real-time notifications for booking confirmations, host messages, and emergency weather advisories.

---

## 6. Architecture & Technology Stack

| Layer | Technology | Function |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router, React 19) | Server components, Server Actions, Turbopack bundling |
| **Language** | TypeScript 5 (Strict Mode) | End-to-end static typing and schema validation |
| **Styling** | Tailwind CSS v4, Radix UI | Mobile-first responsive design system and accessible UI primitives |
| **Database** | Supabase (PostgreSQL 15+) | Row Level Security (RLS), atomic transactions, realtime subscriptions |
| **PWA & Offline** | Serwist (`@serwist/next`) | Service worker runtime caching and offline manifest |
| **QR Engine** | `qrcode` (ISO/IEC 18004) | 100% client-side camera-scannable QR code generation |
| **Push Notifications** | OneSignal SDK & REST API | Browser push alerts for booking updates and advisories |
| **State & Forms** | TanStack Query, React Hook Form, Zod | Server state cache, optimistic updates, and form validation |
| **Hosting** | Vercel | Production hosting, edge routing, and automated continuous delivery |

---

## 7. Directory Structure

```
MVBA-webapp/
├── public/
│   ├── icons/                      # PWA application icons
│   ├── manifest.json               # Web App Manifest (standalone display)
│   └── OneSignalSDKWorker.js       # Push notification service worker
├── src/
│   ├── app/
│   │   ├── (dashboard)/            # Authenticated role portals
│   │   │   ├── admin/              # Municipal & Association Admin Dashboard
│   │   │   ├── homestay/           # Homestay Operator Dashboard
│   │   │   └── resort/             # Resort Operator Dashboard
│   │   ├── (tourist)/              # Public & tourist experience
│   │   │   ├── bookings/           # Reservation ledger and offline pass list
│   │   │   ├── chat/               # Live chat with hosts
│   │   │   ├── explore/            # Bretania 24 Islands travel guide
│   │   │   ├── property/[id]/      # Property listing and booking page
│   │   │   ├── terms/              # Terms of Service
│   │   │   ├── privacy/            # Privacy Policy (RA 10173)
│   │   │   ├── cookies/            # Cookie & Storage Policy
│   │   │   ├── policies/           # Eco-Tourism & Maritime Guidelines
│   │   │   └── page.tsx            # Discovery marketplace homepage
│   │   ├── actions/                # Server Actions (atomic database operations)
│   │   ├── api/                    # Route Handlers (health, notify, revalidate)
│   │   └── proxy.ts                # Next.js Edge proxy middleware
│   ├── components/
│   │   ├── admin/                  # Administrative management components
│   │   ├── layouts/                # Navigation bars, sidebars, and universal footer
│   │   ├── owner/                  # Host components (RoomForm, QRScanner, DuesModal)
│   │   ├── tourist/                # Booking modals, boarding pass dialog, property cards
│   │   └── ui/                     # UI primitives (dialog, badge, button, form)
│   ├── hooks/
│   │   ├── use-auth.ts             # Session and profile listener
│   │   ├── use-offline-boarding-passes.ts # LocalStorage pass caching and network state
│   │   └── use-realtime-messages.ts# WebSocket chat subscriptions
│   └── lib/
│       ├── boarding-pass-generator.ts # ISO QR code and Retina canvas engine
│       ├── supabase/               # Browser, server, and service role clients
│       └── types/                  # TypeScript schema mirroring PostgreSQL tables
├── supabase/
│   ├── schema.sql                  # Canonical base schema and functions
│   ├── concurrency_booking_fix.sql # Atomic booking locking function
│   └── migrations/                 # Incremental SQL migration patches
└── README.md
```

---

## 8. Getting Started

### Prerequisites
- Node.js 20.x or later
- npm 10.x or later
- Supabase account with PostgreSQL 15+

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/mackybotboton-hash/MVBA-webapp.git
   cd MVBA-webapp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the project root:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

   NEXT_PUBLIC_ONESIGNAL_APP_ID=your-onesignal-app-id
   ONESIGNAL_REST_API_KEY=your-onesignal-rest-api-key

   INTERNAL_API_SECRET=your-random-32-byte-hex-secret
   REVALIDATION_SECRET=your-random-32-byte-hex-secret
   CRON_SECRET=your-random-32-byte-hex-secret
   ```

4. Execute database migrations in the Supabase SQL Editor:
   - `supabase/schema.sql`
   - `supabase/concurrency_booking_fix.sql`
   - `supabase/migrations/security-hardening.sql`

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 9. Available Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `dev` | `next dev` | Launches local development server with Turbopack |
| `build` | `next build` | Compiles optimized production bundle |
| `start` | `next start` | Runs production server |
| `lint` | `eslint` | Performs static code quality checks |
| `keep-alive` | `node scripts/keep-alive.mjs` | Pings database to prevent instance pausing |

---

## Administrative Inquiries and License

This software is developed for the **San Agustin Resort & Homestay Association (MVBA)** and the **Municipal Tourism Office of San Agustin, Surigao del Sur**. Unauthorized redistribution or deployment outside accredited municipal operations is prohibited.

Aurora Alliance 2026
