"use client";

import * as React from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const CONSENT_STORAGE_KEY = "mvba_cookie_consent_accepted";

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const consent = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (!consent) {
        // Show after brief delay so it doesn't jarringly jump on load
        const timer = setTimeout(() => setIsVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, "true");
    } catch {}
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Cookie and storage notice"
      className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 z-50 max-w-md rounded-2xl bg-neutral-900 text-white p-4 shadow-2xl border border-neutral-800 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-white/10 text-emerald-400 shrink-0 mt-0.5">
          <Cookie className="h-4 w-4" />
        </div>

        <div className="space-y-2 flex-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-neutral-100">
              Cookie & Offline Storage Notice
            </span>
            <button
              onClick={handleDismiss}
              aria-label="Close cookie notice"
              className="p-1 -mr-1 rounded-md text-neutral-400 hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="text-neutral-300 leading-relaxed text-[11px]">
            We use essential session cookies for secure sign-in and local device
            storage to keep your Digital Boarding Passes accessible offline at
            boat docks without cellular coverage.
          </p>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 text-[11px]">
              <Link
                href="/cookies"
                className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
              >
                Cookie Policy
              </Link>
              <span className="text-neutral-600">•</span>
              <Link
                href="/privacy"
                className="text-neutral-400 underline underline-offset-2 hover:text-neutral-200"
              >
                Privacy Policy
              </Link>
            </div>

            <Button
              size="sm"
              onClick={handleAccept}
              className="bg-white text-neutral-950 hover:bg-neutral-200 text-xs h-7 px-3 font-semibold rounded-lg shrink-0"
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
