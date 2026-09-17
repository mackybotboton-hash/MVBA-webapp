"use client";

import { TouristBottomNav } from "@/components/layouts/tourist-bottom-nav";

export default function TouristLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <main className="pb-20 md:pb-0">{children}</main>
      <TouristBottomNav />
    </div>
  );
}
