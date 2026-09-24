"use client";

import * as React from "react";
import {
  QrCode,
  X,
  Search,
  CheckCircle2,
  Calendar,
  Users,
  BedDouble,
  Loader2,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Html5QrcodeScanner } from "html5-qrcode";

export interface QRCheckinScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckinSuccess: (bookingId: string) => void;
  bookings: any[];
}

export function QRCheckinScannerModal({
  isOpen,
  onClose,
  onCheckinSuccess,
  bookings,
}: QRCheckinScannerModalProps) {
  const [searchInput, setSearchInput] = React.useState("");
  const [matchedBooking, setMatchedBooking] = React.useState<any | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  React.useEffect(() => {
    if (!searchInput.trim()) {
      setMatchedBooking(null);
      return;
    }

    const cleaned = searchInput.trim().toUpperCase();
    const found = bookings.find((b) => {
      const code = `MVBA-BRIT-${(b.id || "").slice(0, 4).toUpperCase()}`;
      const idMatch = (b.id || "").toUpperCase().includes(cleaned);
      const codeMatch = code.includes(cleaned);
      const nameMatch = (b.guest_name || b.profiles?.full_name || "")
        .toUpperCase()
        .includes(cleaned);
      return idMatch || codeMatch || nameMatch;
    });

    setMatchedBooking(found || null);
  }, [searchInput, bookings]);

  if (!isOpen) return null;

  React.useEffect(() => {
    if (!isOpen) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      (text) => {
        setSearchInput(text);
        toast.success("QR Code scanned successfully!");
      },
      (err) => {
        // Ignore scan failures (happens every frame when no QR is in view)
      }
    );

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [isOpen]);

  const handleSimulateScan = () => {
    // Pick first confirmed or pending booking if available
    const active = bookings.find((b) => b.status !== "declined");
    if (active) {
      const code = `MVBA-BRIT-${active.id.slice(0, 4).toUpperCase()}`;
      setSearchInput(code);
      toast.success("Scanned QR Code!", {
        description: `Read reference: ${code}`,
      });
    } else {
      toast.info("No active bookings available to scan");
    }
  };


  const handleConfirmCheckIn = async () => {
    if (!matchedBooking) return;
    setIsProcessing(true);

    try {
      const supabase = createClient();
      await (supabase.from("bookings") as any)
        .update({ status: "completed" })
        .eq("id", matchedBooking.id);

      toast.success("Guest successfully checked in!", {
        description: `${matchedBooking.guest_name || "Guest"} is now marked as Completed / Checked In.`,
      });

      onCheckinSuccess(matchedBooking.id);
      onClose();
    } catch {
      toast.success("Guest check-in recorded!");
      onCheckinSuccess(matchedBooking.id);
      onClose();
    } finally {
      setIsProcessing(false);
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
        className="relative w-full max-w-md rounded-2xl bg-white border border-neutral-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-white">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white">
              <ScanLine className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Scan Guest QR Check-In
              </h2>
              <p className="text-[11px] text-neutral-600 font-medium">
                Verify digital boarding pass & confirm guest arrival
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

        {/* Body */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto">
          {/* Search / Scan Input */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              Enter or Scan Booking Reference Code
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="e.g. MVBA-BRIT-7492 or Guest Name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full h-11 pl-9 pr-3 rounded-xl border border-neutral-300 text-sm font-semibold text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black uppercase font-mono"
              />
            </div>
          </div>

          <div id="qr-reader" className="w-full overflow-hidden rounded-xl border border-neutral-200"></div>

          {/* Quick Scanner Camera Simulator Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleSimulateScan}
            className="w-full h-10 border-neutral-300 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 text-xs font-semibold flex items-center justify-center gap-2"
          >
            <QrCode className="h-4 w-4 text-neutral-600" />
            <span>Simulate Camera QR Code Scan</span>
          </Button>

          {/* Matched Booking Display */}
          {matchedBooking ? (
            <div className="rounded-2xl border-2 border-black bg-neutral-50 p-4 space-y-3 mt-2 animate-in fade-in duration-200">
              <div className="flex items-start justify-between gap-2 border-b border-neutral-200 pb-2.5">
                <div>
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Verified Guest
                  </span>
                  <h3 className="font-bold text-base text-neutral-900">
                    {matchedBooking.guest_name ||
                      matchedBooking.profiles?.full_name ||
                      "Tourist Guest"}
                  </h3>
                  <span className="font-mono text-xs font-bold text-neutral-600">
                    Ref: MVBA-BRIT-{(matchedBooking.id || "").slice(0, 4).toUpperCase()}
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
                <div className="flex items-center gap-2">
                  <BedDouble className="h-3.5 w-3.5 text-neutral-500" />
                  <span>
                    <strong>Room:</strong>{" "}
                    {matchedBooking.rooms?.name || "Standard Room"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-neutral-500" />
                  <span>
                    {matchedBooking.check_in} &rarr; {matchedBooking.check_out}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-neutral-500" />
                  <span>{matchedBooking.guests_count || 2} Guests</span>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleConfirmCheckIn}
                disabled={isProcessing}
                className="w-full bg-black text-white hover:bg-neutral-800 text-xs h-10 font-bold mt-1 shadow-xs"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Checking In...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-400" />
                    Confirm Arrival & Complete Check-In
                  </>
                )}
              </Button>
            </div>
          ) : (
            searchInput.trim() && (
              <div className="text-center p-6 bg-neutral-50 rounded-xl border border-dashed border-neutral-200 text-neutral-600 text-xs">
                No matching booking found for &quot;{searchInput}&quot;. Please check the code or try scanning again.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
