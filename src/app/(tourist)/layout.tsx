"use client";

import { TouristBottomNav } from "@/components/layouts/tourist-bottom-nav";
import { Footer } from "@/components/layouts/footer";

export default function TouristLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col justify-between">
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <Footer />
      <TouristBottomNav />
    </div>
  );
}
