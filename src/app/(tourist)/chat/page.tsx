"use client";

import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { ConnectedChatSystem } from "@/components/shared/connected-chat-system";

export default function TouristChatPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo size="small" />
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Host Messages
            </span>
          </div>

          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 px-3 border-neutral-200 font-semibold"
            >
              Back to Stays
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Connected Chat View */}
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 pb-24 md:pb-6">
        <ConnectedChatSystem
          currentRole="tourist"
          portalTitle="Host Messages & Inquiries"
          portalSubtitle="Communicate directly with your booked homestay or resort hosts in Bretania"
        />
      </main>
    </div>
  );
}
