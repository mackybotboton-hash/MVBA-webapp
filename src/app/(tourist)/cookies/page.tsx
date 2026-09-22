import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Cookie, Server, HardDrive, ShieldCheck } from "lucide-react";
import { PolicyNav } from "@/components/layouts/policy-nav";

export const metadata: Metadata = {
  title: "Cookie Policy | MVBA",
  description:
    "Information regarding cookies, session storage, and offline local caching used by the MVBA Progressive Web Application.",
};

export default function CookiePolicyPage() {
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
            <Cookie className="h-3.5 w-3.5 text-neutral-600" />
            <span>Storage & Tracking Disclosure</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
            Cookie & Storage Policy
          </h1>
          <p className="text-sm text-neutral-600">
            Last Updated: September 2026 | Transparent disclosure of cookies, tokens, and offline caching mechanisms.
          </p>
        </div>

        {/* Policy Tab Navigation */}
        <PolicyNav />

        {/* Content Body */}
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-10 shadow-xs space-y-8 text-neutral-800 text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-950">1. What Are Cookies and Web Storage?</h2>
            <p>
              Cookies are small text files placed on your computer or mobile device by websites that you visit. In addition to cookies, modern web applications utilize browser Web Storage (such as <code>localStorage</code>) and Service Worker caches to provide offline support, secure authentication, and faster page load speeds.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-neutral-950">2. Categories of Storage We Use</h2>

            <div className="space-y-4">
              {/* Essential Authentication */}
              <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-neutral-900 text-sm">
                  <Server className="h-4 w-4 text-emerald-600" />
                  <span>Essential Authentication Cookies (Strictly Necessary)</span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  These cookies are mandatory for the application to function. They store encrypted session tokens allowing you to sign in, remain logged in between page visits, and securely communicate with our backend APIs without re-entering credentials on every click.
                </p>
                <div className="text-[11px] font-mono bg-white p-2.5 rounded-xl border border-neutral-200 text-neutral-700">
                  Identifiers: <code>sb-*-auth-token</code>, <code>sb-*-refresh-token</code>
                </div>
              </div>

              {/* Edge Security */}
              <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-neutral-900 text-sm">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  <span>Zero-Trust Role Validation Cookie (Security)</span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  To protect administrative, homestay, and resort operator portals from unauthorized access, our Edge Proxy maintains a cryptographically verified, <code>httpOnly</code>, <code>secure</code> cookie representing your verified account role. Because it is marked <code>httpOnly</code>, malicious third-party browser scripts cannot inspect or manipulate it.
                </p>
                <div className="text-[11px] font-mono bg-white p-2.5 rounded-xl border border-neutral-200 text-neutral-700">
                  Identifier: <code>mvba_user_role</code> (HttpOnly, Secure, SameSite=Lax)
                </div>
              </div>

              {/* Offline Storage */}
              <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-neutral-900 text-sm">
                  <HardDrive className="h-4 w-4 text-amber-600" />
                  <span>Client-Side Local Storage (Offline Boarding Passes & Preferences)</span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Because cellular signals can be intermittent during boat rides across Lianga Bay and Bretania, our PWA utilizes device <code>localStorage</code> to store your confirmed Digital Boarding Passes. This ensures that you can open and present your scannable QR pass to boat dispatch staff and host check-in desks even while completely offline.
                </p>
                <div className="text-[11px] font-mono bg-white p-2.5 rounded-xl border border-neutral-200 text-neutral-700">
                  Keys: <code>mvba_offline_boarding_passes</code>, <code>mvba_tourist_wishlist</code>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-950">3. Do We Use Third-Party Advertising Cookies?</h2>
            <p>
              <strong>No.</strong> The MVBA platform does not sell personal data, display third-party commercial advertisements, or employ tracking pixels for commercial advertising networks. We use only functional utilities, such as OneSignal for opt-in browser push notifications regarding your booking approvals and weather advisories.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-950">4. How to Control or Delete Cookies</h2>
            <p>
              You can control and manage cookies through your browser settings. However, disabling essential session cookies will prevent you from signing into your account, submitting bookings, or viewing your reservations.
            </p>
            <p className="text-neutral-600 text-xs">
              To clear your offline boarding passes and cached data, you may clear your browser site data for this domain or log out of your session.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
