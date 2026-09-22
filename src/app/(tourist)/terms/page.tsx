import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle2 } from "lucide-react";
import { PolicyNav } from "@/components/layouts/policy-nav";

export const metadata: Metadata = {
  title: "Terms of Service | MVBA",
  description:
    "Official terms and conditions for booking accommodations and island tours through the San Agustin Resort & Homestay Association.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-neutral-50/50">
      {/* Top Header */}
      <header className="sticky top-0 z-30 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-neutral-600 hover:text-black transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Discovery</span>
          </Link>
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Legal & Governance
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Page Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-semibold">
            <FileText className="h-3.5 w-3.5" />
            <span>Official Policy Document</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
            Terms of Service
          </h1>
          <p className="text-sm text-neutral-600">
            Last Updated: September 2026 | Effective for all accredited homestays, resorts, and tourist reservations in San Agustin, Surigao del Sur.
          </p>
        </div>

        {/* Policy Tab Navigation */}
        <PolicyNav />

        {/* Content Body */}
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-10 shadow-xs space-y-8 text-neutral-800 text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-950">1. Acceptance of Terms</h2>
            <p>
              By accessing, browsing, or creating a reservation through the San Agustin Resort and Homestay Association (MVBA) platform, you acknowledge that you have read, understood, and agree to be legally bound by these Terms of Service, along with our Privacy Policy, Cookie Policy, and Municipal Eco-Tourism Guidelines. If you do not accept these terms, you must refrain from using the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-950">2. Reservation and Downpayment Policy</h2>
            <p>
              To ensure fair allocation of accredited accommodations and island-hopping services in Bretania, all reservations are governed by the following rules:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-neutral-700">
              <li>
                <strong>20% Mandatory Downpayment:</strong> Once a property host accepts your booking request, a twenty percent (20%) downpayment of the total accommodation fee must be remitted via GCash within 24 hours to secure the reservation dates.
              </li>
              <li>
                <strong>Receipt Submission:</strong> Tourists must provide a valid GCash transaction reference number and screenshot proof of payment through their portal.
              </li>
              <li>
                <strong>Verification & Confirmation:</strong> The association administration and host verify payment legitimacy before issuing an official Digital Boarding Pass with a scannable QR code.
              </li>
              <li>
                <strong>Remaining Balance:</strong> The remaining eighty percent (80%) balance, along with any optional addon services, is payable directly to the property upon check-in.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-950">3. Cancellation and Refund Policy</h2>
            <p>
              Reservations are managed in accordance with municipal tourism fairness standards:
            </p>
            <div className="rounded-2xl bg-neutral-50 p-4 border border-neutral-200 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Free Cancellation (7+ Days Prior):</strong> Full refund of downpayment if cancelled at least seven (7) full calendar days before the scheduled check-in date, minus any standard bank processing charges.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Partial Refund (3 to 6 Days Prior):</strong> 50% refund of the downpayment amount if cancelled within 3 to 6 days of check-in.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Non-Refundable (Under 48 Hours / No-Show):</strong> Cancellations made within 48 hours of check-in are strictly non-refundable to compensate operators for reserved room inventory.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Force Majeure & Maritime Gale Warnings:</strong> If boat trips or tourist operations are halted due to Philippine Coast Guard gale warnings, severe weather, or government travel restrictions, guests may reschedule without penalty or receive a full 100% refund.
                </span>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-950">4. Guest Check-in and Boarding Pass</h2>
            <p>
              Guests must present their official MVBA Digital Boarding Pass upon arrival at their accommodation or boat dispatch terminal. The pass can be displayed from your mobile device or saved to your device camera roll for offline presentation. Check-in is generally at 2:00 PM, and check-out is by 12:00 PM noon, unless special arrangements have been approved by the host.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-950">5. Property Host and Operator Standards</h2>
            <p>
              All homestay and resort listings featured on the platform must be accredited by the San Agustin Municipal Tourism Office and maintain active standing in the association. Hosts agree to honor all confirmed bookings, provide clean and secure facilities, adhere to regulated tariff rates, and comply with municipal sanitary and environmental standards.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-950">6. Platform Limitation of Liability</h2>
            <p>
              The MVBA web application functions as an accreditation, reservation, and dispatch clearinghouse for the municipal tourism sector. While the association vets operators, individual properties are operated independently. Guests are advised to exercise reasonable care during island-hopping and aquatic activities.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-neutral-200">
            <h2 className="text-base font-bold text-neutral-950">Contact and Inquiries</h2>
            <p className="text-neutral-600">
              For questions regarding these terms, please contact the San Agustin Municipal Tourism Office or the MVBA Secretariat at <strong>tourism@sanagustin.gov.ph</strong>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
