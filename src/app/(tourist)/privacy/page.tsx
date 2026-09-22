import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Shield, Lock, Eye, FileCheck } from "lucide-react";
import { PolicyNav } from "@/components/layouts/policy-nav";

export const metadata: Metadata = {
  title: "Privacy Policy | MVBA",
  description:
    "Data privacy and protection policy of the San Agustin Resort & Homestay Association under the Philippine Data Privacy Act of 2012 (RA 10173).",
};

export default function PrivacyPolicyPage() {
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
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
            <Shield className="h-3.5 w-3.5 text-emerald-600" />
            <span>Republic Act 10173 Compliant</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-neutral-600">
            Last Updated: September 2026 | Governing the collection, storage, and processing of tourist and operator personal data.
          </p>
        </div>

        {/* Policy Tab Navigation */}
        <PolicyNav />

        {/* Content Body */}
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-10 shadow-xs space-y-8 text-neutral-800 text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-950">1. Commitment to Privacy</h2>
            <p>
              The San Agustin Resort and Homestay Association (MVBA), in coordination with the Municipal Tourism Office of San Agustin, Surigao del Sur, is committed to safeguarding your personal data in accordance with Republic Act No. 10173, otherwise known as the <em>Philippine Data Privacy Act of 2012 (DPA)</em>, and its Implementing Rules and Regulations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-950">2. Personal Information We Collect</h2>
            <p>
              To process reservations, coordinate island boat dispatches, and verify payments, we collect the following categories of information:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-neutral-900 text-xs uppercase tracking-wider">
                  <FileCheck className="h-4 w-4 text-emerald-600" />
                  <span>Account & Contact</span>
                </div>
                <p className="text-xs text-neutral-600">
                  Full name, email address, mobile phone number, and optional profile photo.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-neutral-900 text-xs uppercase tracking-wider">
                  <Lock className="h-4 w-4 text-blue-600" />
                  <span>Payment & Verification</span>
                </div>
                <p className="text-xs text-neutral-600">
                  GCash reference numbers, transaction dates, and uploaded deposit receipt screenshots.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-neutral-900 text-xs uppercase tracking-wider">
                  <Eye className="h-4 w-4 text-amber-600" />
                  <span>Maritime Passenger Manifest</span>
                </div>
                <p className="text-xs text-neutral-600">
                  Guest count, passenger names, and departure dates required by the Philippine Coast Guard.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-neutral-900 text-xs uppercase tracking-wider">
                  <Shield className="h-4 w-4 text-purple-600" />
                  <span>Device & Security</span>
                </div>
                <p className="text-xs text-neutral-600">
                  Authentication tokens, IP address for audit logs, and push notification tokens.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-950">3. Purpose of Data Processing</h2>
            <p>
              Your personal data is processed solely for legitimate municipal tourism purposes:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-neutral-700">
              <li>Facilitating accommodation reservations and issuing official Digital Boarding Passes.</li>
              <li>Reconciling downpayments with host records and the association treasury.</li>
              <li>Complying with maritime safety regulations and official passenger manifests for boat transfers.</li>
              <li>Sending transactional updates, booking confirmations, and urgent weather advisories.</li>
              <li>Preventing fraudulent bookings and unauthorized operator activity.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-950">4. Storage Security & Access Controls</h2>
            <p>
              We implement comprehensive technical and organizational safeguards:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-neutral-700">
              <li>
                <strong>Private Storage Buckets:</strong> GCash receipts and sensitive verification documents are stored in private cloud storage. They are never exposed publicly and can only be accessed through short-lived, cryptographically signed URLs.
              </li>
              <li>
                <strong>Row Level Security (RLS):</strong> Database-level access rules guarantee that tourists can only view their own reservations, and hosts can only access bookings associated with their accredited properties.
              </li>
              <li>
                <strong>Encrypted Communications:</strong> All network communication is encrypted in transit using Transport Layer Security (TLS 1.3).
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-950">5. Your Rights as a Data Subject</h2>
            <p>
              Under the Data Privacy Act of 2012, you possess the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-neutral-700">
              <li>Be informed whether your personal data is being processed.</li>
              <li>Access and request a copy of your stored personal information.</li>
              <li>Rectify or update any inaccurate or outdated information in your profile.</li>
              <li>Request the erasure or blocking of your personal data when no longer necessary for legal or regulatory purposes.</li>
            </ul>
          </section>

          <section className="space-y-3 pt-4 border-t border-neutral-200">
            <h2 className="text-base font-bold text-neutral-950">Data Protection Officer</h2>
            <p className="text-neutral-600">
              To exercise your data privacy rights or file an inquiry, contact our Data Protection Officer at <strong>dpo@sanagustin.gov.ph</strong> or visit the Municipal Tourism Information Center, San Agustin, Surigao del Sur.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
