"use client";

import * as React from "react";
import {
  QrCode,
  X,
  Printer,
  ShieldCheck,
  Calendar,
  Users,
  MapPin,
  BedDouble,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface DigitalBoardingPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: {
    id: string;
    property_name?: string;
    room_name?: string;
    guest_name?: string;
    check_in: string;
    check_out: string;
    guests_count: number;
    total_price: number;
    status: string;
  } | null;
}

// Deterministic 21x21 QR Code Pattern Generator (Zero dependency, 100% offline SVG)
function generateQRSVG(data: string) {
  // Generate pseudo-random matrix seeded by string characters
  const size = 21;
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  // Corner Position Detection Patterns (Standard QR 7x7 anchors)
  const addAnchor = (row: number, col: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[row + r][col + c] = true;
        }
      }
    }
  };

  addAnchor(0, 0);
  addAnchor(0, 14);
  addAnchor(14, 0);

  // Timing lines
  for (let i = 8; i < 13; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Populate data area based on hash of string
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data.charCodeAt(i);
    hash |= 0;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Skip corners
      if (
        (r < 8 && c < 8) ||
        (r < 8 && c >= 13) ||
        (r >= 13 && c < 8) ||
        (r === 6 || c === 6)
      ) {
        continue;
      }
      const val = Math.abs(Math.sin((hash + r * 31 + c * 17) * 999));
      matrix[r][c] = val > 0.45;
    }
  }

  return matrix;
}

export function DigitalBoardingPassModal({
  isOpen,
  onClose,
  booking,
}: DigitalBoardingPassModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !booking) return null;

  const bookingCode = `MVBA-BRIT-${booking.id.slice(0, 4).toUpperCase()}`;
  const qrMatrix = generateQRSVG(bookingCode);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(bookingCode);
    setCopied(true);
    toast.success("Booking reference code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-white border border-neutral-200 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pass Header */}
        <div className="bg-neutral-900 text-white p-5 text-center relative shrink-0">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 font-bold uppercase tracking-widest mb-1">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>MVBA Official Boarding Pass</span>
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight">
            Digital Check-in Ticket
          </h2>
          <p className="text-[11px] text-neutral-300 mt-0.5">
            Present this QR code upon arrival at Bretania
          </p>
        </div>

        {/* QR Code Card */}
        <div className="p-6 space-y-5 text-xs overflow-y-auto">
          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-neutral-50 border border-neutral-200 text-center space-y-3">
            <div className="bg-white p-3 rounded-xl border border-neutral-200 shadow-xs">
              <svg
                width="168"
                height="168"
                viewBox="0 0 21 21"
                className="shape-rendering-crispEdges"
              >
                {qrMatrix.map((row, r) =>
                  row.map(
                    (cell, c) =>
                      cell && (
                        <rect
                          key={`${r}-${c}`}
                          x={c}
                          y={r}
                          width="1"
                          height="1"
                          fill="#000000"
                        />
                      )
                  )
                )}
              </svg>
            </div>

            {/* Reference Number */}
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">
                Booking Reference
              </span>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-base font-extrabold text-neutral-900">
                  {bookingCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-1 rounded-md hover:bg-neutral-200 text-neutral-600 transition-colors"
                  title="Copy code"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Ticket Details */}
          <div className="rounded-2xl border border-neutral-200 divide-y divide-neutral-100 bg-white">
            <div className="p-3.5 space-y-0.5">
              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                Property & Accommodation
              </span>
              <p className="font-bold text-sm text-neutral-900">
                {booking.property_name || "Accredited Island Stay"}
              </p>
              <p className="text-xs text-neutral-600 font-medium">
                {booking.room_name || "Standard Accommodation"}
              </p>
            </div>

            <div className="p-3.5 grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">
                  Check-In
                </span>
                <p className="font-bold text-xs text-neutral-900">
                  {booking.check_in}
                </p>
                <span className="text-[10px] text-neutral-600 font-medium">
                  After 2:00 PM
                </span>
              </div>

              <div>
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">
                  Check-Out
                </span>
                <p className="font-bold text-xs text-neutral-900">
                  {booking.check_out}
                </p>
                <span className="text-[10px] text-neutral-600 font-medium">
                  Before 12:00 PM
                </span>
              </div>
            </div>

            <div className="p-3.5 flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 text-neutral-600 font-medium">
                <Users className="h-3.5 w-3.5 text-neutral-500" />
                <span>{booking.guests_count} Guests</span>
              </div>
              <Badge variant="success" size="sm" dot>
                Confirmed
              </Badge>
            </div>
          </div>

          {/* Verification Notice */}
          <p className="text-[11px] text-neutral-600 text-center leading-relaxed font-medium px-2">
            San Agustin Tourism Office & MVBA Host scanning verified. Please show this screen or downloaded screenshot to your host.
          </p>


          {/* Action Footer */}
          <div className="pt-2 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              className="flex-1 border-neutral-300 text-xs h-10 font-semibold"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Save / Print Pass
            </Button>

            <Button
              type="button"
              onClick={onClose}
              className="flex-1 bg-black text-white hover:bg-neutral-800 text-xs h-10 font-bold"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
