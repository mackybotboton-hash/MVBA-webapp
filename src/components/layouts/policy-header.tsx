"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface PolicyHeaderProps {
  category?: string;
}

export function PolicyHeader({ category = "Legal & Governance" }: PolicyHeaderProps) {
  const searchParams = useSearchParams();
  const isFromBooking = searchParams.get("from") === "booking" && !!searchParams.get("propertyId");

  const propertyId = searchParams.get("propertyId");
  const roomId = searchParams.get("roomId");
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const guests = searchParams.get("guests");

  const backHref = isFromBooking
    ? `/property/${propertyId}?openBooking=true${
        roomId ? `&roomId=${roomId}` : ""
      }${checkIn ? `&checkIn=${checkIn}` : ""}${
        checkOut ? `&checkOut=${checkOut}` : ""
      }${guests ? `&guests=${guests}` : ""}`
    : "/";

  const backLabel = isFromBooking ? "Back to Request Modal" : "Back to Discovery";

  return (
    <header className="sticky top-0 z-30 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
        <Link
          href={backHref}
          className="flex items-center gap-2 text-xs font-semibold text-neutral-600 hover:text-black transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{backLabel}</span>
        </Link>
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
          {category}
        </span>
      </div>
    </header>
  );
}
