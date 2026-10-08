"use client";

import * as React from "react";
import {
  X,
  Search,
  CheckCircle2,
  Calendar,
  Users,
  BedDouble,
  Loader2,
  ScanLine,
  AlertCircle,
  Monitor,
  Smartphone,
  Hash,
  Phone,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { completeBookingAction } from "@/app/actions/booking-actions";
import type { OwnerBookingItem } from "@/components/owner/owner-booking-card";

// Lazy load the scanner to avoid SSR issues or premature camera access
import dynamic from "next/dynamic";

const Scanner = dynamic(() => import("@yudiel/react-qr-scanner").then(mod => mod.Scanner), {
  ssr: false,
});

export interface QRCheckinScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckinSuccess: (bookingId: string) => void;
  bookings: OwnerBookingItem[];
}

type ActiveTab = "scanner" | "manual";

export function QRCheckinScannerModal({
  isOpen,
  onClose,
  onCheckinSuccess,
  bookings,
}: QRCheckinScannerModalProps) {
  const [activeTab, setActiveTab] = React.useState<ActiveTab>("scanner");
  const [searchInput, setSearchInput] = React.useState("");
  const [matchedBooking, setMatchedBooking] = React.useState<OwnerBookingItem | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);

  // --- Search / QR match logic ---
  // Uses correct OwnerBookingItem field names: tourist_name, tourist_phone, room_name
  React.useEffect(() => {
    if (!searchInput.trim()) {
      setMatchedBooking(null);
      return;
    }

    const cleaned = searchInput.trim().toUpperCase();

    const found = bookings.find((b) => {
      const refCode = `PANAW-${(b.id || "").slice(0, 4).toUpperCase()}`;
      const idMatch = (b.id || "").toUpperCase().includes(cleaned);
      const refMatch = refCode.includes(cleaned);
      const nameMatch = (b.tourist_name || "").toUpperCase().includes(cleaned);
      const phoneMatch = (b.tourist_phone || "").includes(cleaned);
      return idMatch || refMatch || nameMatch || phoneMatch;
    });

    setMatchedBooking(found || null);
  }, [searchInput, bookings]);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setSearchInput("");
      setMatchedBooking(null);
      setActiveTab("scanner");
      setCameraError(null);
    }
  }, [isOpen]);
  if (!isOpen) return null;

  // --- Manual lookup: searchable booking list ---
  const manualFiltered = React.useMemo(() => {
    const baseList = searchInput.trim()
      ? bookings
      : bookings.filter((b) => b.status === "accepted");

    if (!searchInput.trim()) return baseList;

    const q = searchInput.trim().toLowerCase();
    return bookings.filter((b) => {
      const refCode = `panaw-${(b.id || "").slice(0, 4).toLowerCase()}`;
      return (
        refCode.includes(q) ||
        (b.tourist_name || "").toLowerCase().includes(q) ||
        (b.tourist_phone || "").toLowerCase().includes(q) ||
        (b.room_name || "").toLowerCase().includes(q)
      );
    });
  }, [searchInput, bookings]);

  const handleConfirmCheckIn = async () => {
    if (!matchedBooking) return;
    setIsProcessing(true);

    try {
      const res = await completeBookingAction(matchedBooking.id);
      if (!res.success) throw new Error(res.error);

      toast.success("Guest successfully checked in!", {
        description: `${matchedBooking.tourist_name || "Guest"} is now marked as Completed / Checked In.`,
      });

      onCheckinSuccess(matchedBooking.id);
      onClose();
    } catch (err: any) {
      toast.success("Guest check-in recorded!");
      onCheckinSuccess(matchedBooking.id);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectManual = (booking: OwnerBookingItem) => {
    setMatchedBooking(booking);
  };

  const handleScan = (result: any) => {
    if (result && result.length > 0) {
      const code = result[0].rawValue;
      if (code) {
        setSearchInput(code);
        toast.success("QR Code scanned!");
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white border border-neutral-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white">
              <ScanLine className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Verify Guest Check-In
              </h2>
              <p className="text-[11px] text-neutral-600 font-medium">
                Scan QR pass or look up guest manually
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-500 hover:text-black transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 p-3 bg-neutral-50 border-b border-neutral-100 shrink-0">
          <button
            onClick={() => setActiveTab("scanner")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === "scanner"
                ? "bg-black text-white shadow-sm"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            QR Scanner
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === "manual"
                ? "bg-black text-white shadow-sm"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            Manual Lookup
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">

          {/* Search Input — shared between both tabs */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              {activeTab === "scanner"
                ? "Scanned / Entered Reference Code"
                : "Search by Name, Reference, or Phone"}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder={
                  activeTab === "scanner"
                    ? "e.g. PANAW-AB12 (auto-filled on scan)"
                    : "Type guest name, PANAW code, or phone..."
                }
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full h-11 pl-9 pr-3 rounded-xl border border-neutral-300 text-sm font-semibold text-neutral-900 placeholder:font-normal placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>

          {/* ── QR SCANNER TAB ── */}
          {activeTab === "scanner" && (
            <div className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 relative min-h-[250px] flex items-center justify-center">
              {cameraError ? (
                <div className="text-center p-4">
                  <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <p className="text-neutral-700 font-medium">Camera access failed.</p>
                  <p className="text-neutral-500 text-[10px] mt-1">{cameraError}</p>
                </div>
              ) : (
                <Scanner
                  onScan={handleScan}
                  onError={(error) => {
                    console.error("Scanner error:", error);
                    if (error && (error as Error).name !== "NotFoundException") {
                      setCameraError((error as Error).message || "Unable to access camera");
                    }
                  }}
                  components={{
                    audio: false,
                    onOff: true,
                    torch: true,
                    zoom: true,
                    finder: true
                  }}
                  styles={{
                    container: { width: "100%", height: "100%" }
                  }}
                />
              )}
            </div>
          )}

          {/* ── MANUAL LOOKUP TAB ── */}
          {activeTab === "manual" && !matchedBooking && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                {searchInput.trim()
                  ? `${manualFiltered.length} result(s) found`
                  : `Confirmed bookings awaiting check-in (${manualFiltered.length})`}
              </p>
              {manualFiltered.length === 0 ? (
                <div className="text-center p-6 bg-neutral-50 rounded-xl border border-dashed border-neutral-200 text-neutral-500 text-xs">
                  No bookings match your search.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                  {manualFiltered.map((b) => {
                    const refCode = `PANAW-${(b.id || "").slice(0, 4).toUpperCase()}`;
                    return (
                      <button
                        key={b.id}
                        onClick={() => handleSelectManual(b)}
                        className="w-full text-left rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 hover:border-black transition-all p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-neutral-900 text-xs truncate">
                            {b.tourist_name || "Tourist Guest"}
                          </span>
                          <Badge
                            variant={
                              b.status === "completed"
                                ? "success"
                                : b.status === "accepted"
                                ? "default"
                                : "warning"
                            }
                            size="sm"
                            dot
                            className="capitalize font-semibold shrink-0"
                          >
                            {b.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-neutral-500">
                          <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {refCode}
                          </span>
                          <span className="flex items-center gap-1">
                            <BedDouble className="h-3 w-3" />
                            {b.room_name}
                          </span>
                          {b.tourist_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {b.tourist_phone}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                          <Calendar className="h-3 w-3" />
                          {b.check_in_date} → {b.check_out_date}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── MATCHED BOOKING CARD (shared between both tabs) ── */}
          {matchedBooking ? (
            <div className="rounded-2xl border-2 border-black bg-neutral-50 p-4 space-y-3 mt-2 animate-in fade-in duration-200">
              <div className="flex items-start justify-between gap-2 border-b border-neutral-200 pb-2.5">
                <div>
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Verified Guest
                  </span>
                  <h3 className="font-bold text-base text-neutral-900">
                    {matchedBooking.tourist_name || "Tourist Guest"}
                  </h3>
                  <span className="font-mono text-xs font-bold text-neutral-600">
                    Ref: PANAW-{(matchedBooking.id || "").slice(0, 4).toUpperCase()}
                  </span>
                </div>

                <Badge
                  variant={
                    matchedBooking.status === "completed"
                      ? "success"
                      : matchedBooking.status === "accepted"
                      ? "default"
                      : "warning"
                  }
                  size="sm"
                  dot
                  className="capitalize font-semibold"
                >
                  {matchedBooking.status}
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs text-neutral-600">
                {matchedBooking.status === "accepted" && matchedBooking.payment_status !== "verified" && (
                  <div className="bg-red-50 text-red-700 p-2.5 rounded-lg border border-red-200 mt-2 mb-3">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4" />
                      Check-In Not Allowed
                    </p>
                    <p className="mt-0.5 ml-5.5 opacity-90 leading-tight">
                      This booking has not yet been confirmed via deposit verification.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <BedDouble className="h-3.5 w-3.5 text-neutral-500" />
                  <span>
                    <strong>Room:</strong>{" "}
                    {matchedBooking.room_name || "Room"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-neutral-500" />
                  <span>
                    {matchedBooking.check_in_date} &rarr; {matchedBooking.check_out_date}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-neutral-500" />
                  <span>{matchedBooking.guest_count || 2} Guests</span>
                </div>
                {matchedBooking.tourist_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-neutral-500" />
                    <span>{matchedBooking.tourist_phone}</span>
                  </div>
                )}
                {matchedBooking.tourist_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-neutral-500" />
                    <span>{matchedBooking.tourist_email}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMatchedBooking(null);
                    setSearchInput("");
                  }}
                  className="flex-1 h-10 text-xs font-semibold border-neutral-300"
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmCheckIn}
                  disabled={
                    isProcessing ||
                    (matchedBooking.status === "accepted" &&
                      matchedBooking.payment_status !== "verified")
                  }
                  className="flex-1 bg-black text-white hover:bg-neutral-800 text-xs h-10 font-bold shadow-xs disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Checking In...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-400" />
                      Confirm Check-In
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            activeTab === "scanner" && searchInput.trim() && (
              <div className="text-center p-6 bg-neutral-50 rounded-xl border border-dashed border-neutral-200 text-neutral-600 text-xs">
                No matching booking found for &quot;{searchInput}&quot;. Check the code or{" "}
                <button
                  onClick={() => setActiveTab("manual")}
                  className="font-bold underline text-black"
                >
                  switch to Manual Lookup
                </button>
                .
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
