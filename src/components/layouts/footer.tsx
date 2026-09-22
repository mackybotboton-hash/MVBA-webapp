"use client";

import Link from "next/link";
import { ShieldCheck, MapPin, Phone, Mail } from "lucide-react";
import { Logo } from "@/components/shared/logo";

export function Footer() {
  return (
    <footer className="w-full border-t border-neutral-200 bg-neutral-50/80 text-neutral-600 text-xs mt-12 pb-24 md:pb-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand & Mission */}
          <div className="space-y-3 md:col-span-1">
            <Logo size="default" />
            <p className="text-neutral-500 leading-relaxed">
              Official booking and dispatch platform for accredited homestays, resorts, and eco-tourism operators across the 24 islands of Bretania.
            </p>
            <div className="flex items-center gap-1.5 text-neutral-700 font-semibold pt-1">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>San Agustin Municipal Tourism</span>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-neutral-900 uppercase tracking-wider text-[11px]">
              Explore Bretania
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="hover:text-neutral-950 transition-colors">
                  Accredited Stays & Resorts
                </Link>
              </li>
              <li>
                <Link href="/explore" className="hover:text-neutral-950 transition-colors">
                  24 Islands Travel Guide
                </Link>
              </li>
              <li>
                <Link href="/bookings" className="hover:text-neutral-950 transition-colors">
                  My Reservations & Boarding Passes
                </Link>
              </li>
              <li>
                <Link href="/wishlist" className="hover:text-neutral-950 transition-colors">
                  Saved Favorites
                </Link>
              </li>
            </ul>
          </div>

          {/* Policies & Governance */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-neutral-900 uppercase tracking-wider text-[11px]">
              Policies & Governance
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/terms" className="hover:text-neutral-950 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-neutral-950 transition-colors">
                  Privacy Policy (RA 10173)
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-neutral-950 transition-colors">
                  Cookie & Storage Policy
                </Link>
              </li>
              <li>
                <Link href="/policies" className="hover:text-neutral-950 transition-colors">
                  Eco-Tourism & Maritime Safety
                </Link>
              </li>
            </ul>
          </div>

          {/* Tourism Office Information */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-neutral-900 uppercase tracking-wider text-[11px]">
              Tourism Information Center
            </h4>
            <ul className="space-y-2 text-neutral-500">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
                <span>Municipal Tourism Office, San Agustin, Surigao del Sur, Philippines</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-neutral-400 shrink-0" />
                <span>tourism@sanagustin.gov.ph</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-neutral-400 shrink-0" />
                <span>Bretania Pier Dispatch: Local 104</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-neutral-400 text-[11px]">
          <p>
            © 2026 San Agustin Resort & Homestay Association (MVBA). All rights reserved.
          </p>
          <p className="font-medium text-neutral-500">
            Aurora Alliance 2026
          </p>
        </div>
      </div>
    </footer>
  );
}
