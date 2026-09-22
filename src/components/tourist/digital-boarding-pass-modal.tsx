"use client";

import * as React from "react";
import {
  X,
  Printer,
  ShieldCheck,
  Users,
  Copy,
  Check,
  Download,
  Share2,
  Smartphone,
  WifiOff,
  Wifi,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BoardingPassData,
  generateQRCodeDataURL,
  downloadBoardingPassImage,
  shareBoardingPass,
} from "@/lib/boarding-pass-generator";
import { useOfflineBoardingPasses } from "@/hooks/use-offline-boarding-passes";

export interface DigitalBoardingPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BoardingPassData | null;
}

export function DigitalBoardingPassModal({
  isOpen,
  onClose,
  booking,
}: DigitalBoardingPassModalProps) {
  const [copied, setCopied] = React.useState(false);
  const [qrCodeUrl, setQrCodeUrl] = React.useState<string | null>(null);
  const [isGeneratingImg, setIsGeneratingImg] = React.useState(false);
  const { isOnline, savePass, hasPass } = useOfflineBoardingPasses();

  const bookingCode = booking
    ? booking.reference_code ||
      `MVBA-BRIT-${booking.id.slice(0, 4).toUpperCase()}`
    : "";

  // Generate genuine ISO QR code and auto-cache booking whenever modal opens
  React.useEffect(() => {
    if (!isOpen || !booking) return;

    // Cache locally for offline access
    savePass(booking);

    let isMounted = true;
    generateQRCodeDataURL(bookingCode)
      .then((url) => {
        if (isMounted) setQrCodeUrl(url);
      })
      .catch((err) => {
        console.error("Failed to generate QR code data URL:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, booking, bookingCode, savePass]);

  if (!isOpen || !booking) return null;

  const isCached = hasPass(booking.id);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(bookingCode);
    setCopied(true);
    toast.success("Booking reference code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadImage = async () => {
    try {
      setIsGeneratingImg(true);
      await downloadBoardingPassImage(booking);
      toast.success("Boarding pass downloaded as PNG!");
    } catch (err: any) {
      console.error(err);
      toast.error("Could not generate pass image. Please try again.");
    } finally {
      setIsGeneratingImg(false);
    }
  };

  const handleShareOrSaveToPhotos = async () => {
    try {
      setIsGeneratingImg(true);
      const res = await shareBoardingPass(booking);
      if (res.method === "share" && res.success) {
        toast.success("Boarding pass shared / saved to device!");
      } else if (res.method === "download") {
        toast.success("Boarding pass saved to downloads!");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to export boarding pass.");
    } finally {
      setIsGeneratingImg(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="boarding-pass-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-white border border-neutral-200 shadow-2xl overflow-hidden flex flex-col max-h-[96vh] animate-in fade-in-50 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pass Header Banner */}
        <div className="bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-900 text-white p-5 text-center relative shrink-0">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-400 font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>MVBA Official Boarding Pass</span>
          </div>

          <h2
            id="boarding-pass-title"
            className="text-xl font-extrabold text-white tracking-tight"
          >
            Digital Check-in Pass
          </h2>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            San Agustin & Bretania Island Dispatch
          </p>

          {/* Offline / Online Status Indicator */}
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-medium text-neutral-300 backdrop-blur-xs">
            {isOnline ? (
              <>
                <Wifi className="h-3 w-3 text-emerald-400" />
                <span>Device Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-amber-400" />
                <span>Offline Mode (Cached on Device)</span>
              </>
            )}
            {isCached && (
              <span className="text-emerald-400 font-semibold ml-1">
                • Offline Ready
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Pass Body */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto">
          {/* Scannable Real QR Container */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-center space-y-2.5">
            <div className="relative bg-white p-3 rounded-2xl border border-neutral-200 shadow-sm flex items-center justify-center">
              {qrCodeUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrCodeUrl}
                  alt={`Scannable QR Code for ${bookingCode}`}
                  className="w-44 h-44 object-contain rounded-lg"
                  width={176}
                  height={176}
                />
              ) : (
                <div className="w-44 h-44 flex items-center justify-center text-neutral-400 text-xs">
                  Generating camera-scannable QR...
                </div>
              )}
            </div>

            {/* Reference Number */}
            <div className="space-y-0.5">
              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">
                Booking Reference
              </span>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-base font-extrabold text-neutral-900 tracking-wider">
                  {bookingCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-1 rounded-md hover:bg-neutral-200 text-neutral-600 transition-colors"
                  title="Copy reference code"
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

          {/* Quick 1-Tap Save Actions (Photos / Share / Download) */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="default"
              disabled={isGeneratingImg}
              onClick={handleShareOrSaveToPhotos}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-10 shadow-xs flex items-center justify-center gap-1.5"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Save to Photos</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isGeneratingImg}
              onClick={handleDownloadImage}
              className="border-neutral-300 text-neutral-800 hover:bg-neutral-100 font-semibold text-xs h-10 flex items-center justify-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PNG</span>
            </Button>
          </div>

          {/* Ticket Details Box */}
          <div className="rounded-2xl border border-neutral-200 divide-y divide-neutral-100 bg-white shadow-xs">
            <div className="p-3.5 space-y-0.5">
              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                Accommodation & Stay
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
                <span className="text-[10px] text-emerald-600 font-semibold">
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
                <span className="text-[10px] text-neutral-500 font-medium">
                  Before 12:00 PM
                </span>
              </div>
            </div>

            <div className="p-3.5 flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 text-neutral-700 font-medium">
                <Users className="h-3.5 w-3.5 text-neutral-500" />
                <span>{booking.guests_count} Guests</span>
              </div>
              <Badge variant="success" size="sm" dot>
                Deposit Verified
              </Badge>
            </div>
          </div>

          {/* Offline Advice Callout */}
          <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2 text-[11px] text-amber-900 leading-relaxed">
            <Smartphone className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Island Tip:</strong> Cellular signal is weak during boat
              transits. Tap <strong>Save to Photos</strong> to keep your pass in
              your camera roll for offline dock check-in!
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-1 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              className="flex-1 border-neutral-300 text-xs h-9 font-semibold"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Print Pass
            </Button>

            <Button
              type="button"
              onClick={onClose}
              className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white text-xs h-9 font-bold"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
