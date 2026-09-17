"use client";

import Link from "next/link";
import { Heart, Ticket } from "lucide-react";
import { useWishlist } from "@/hooks/use-wishlist";

export function ProfileActivityStats({
  activeBookingsCount = 0,
}: {
  activeBookingsCount?: number;
}) {
  const { count: savedCount } = useWishlist();

  return (
    <div className="grid grid-cols-2 gap-3">
      <Link
        href="/bookings"
        className="rounded-xl border border-neutral-200 p-4 bg-white hover:border-neutral-300 transition-all flex items-center justify-between group"
      >
        <div>
          <span className="text-xs text-neutral-600 font-medium block">
            Reservations
          </span>
          <p className="text-lg font-bold text-neutral-900 mt-0.5 group-hover:text-black">
            {activeBookingsCount > 0 ? `${activeBookingsCount} Active` : "My Bookings"}
          </p>
        </div>
        <div className="h-9 w-9 rounded-lg bg-neutral-50 flex items-center justify-center text-neutral-500 group-hover:text-black transition-colors">
          <Ticket className="h-5 w-5" />
        </div>
      </Link>

      <Link
        href="/wishlist"
        className="rounded-xl border border-neutral-200 p-4 bg-white hover:border-neutral-300 transition-all flex items-center justify-between group"
      >
        <div>
          <span className="text-xs text-neutral-600 font-medium block">
            Saved Stays
          </span>
          <p className="text-lg font-bold text-neutral-900 mt-0.5 group-hover:text-red-500 transition-colors">
            {savedCount > 0 ? `${savedCount} Saved` : "Wishlist"}
          </p>
        </div>
        <div className="h-9 w-9 rounded-lg bg-red-50/50 flex items-center justify-center text-red-400 group-hover:text-red-500 transition-colors">
          <Heart className="h-5 w-5 fill-red-500 text-red-500" />
        </div>
      </Link>
    </div>
  );
}
