"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Receipt, Hash, RefreshCw } from "lucide-react";
import Image from "next/image";
import { BookingData } from "@/components/tourist/booking-card";
import { createClient } from "@/lib/supabase/client";

interface TouristViewPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingData | null;
}

export function TouristViewPaymentModal({ isOpen, onClose, booking }: TouristViewPaymentModalProps) {
  const [signedUrl, setSignedUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Parse receipt_url which is stored as "path|refNumber"
  const rawReceipt = booking?.receipt_url || "";
  const parts = rawReceipt.split("|");
  const receiptPath = parts[0];
  const gcashReference = parts.length > 1 ? parts[1] : "N/A";

  React.useEffect(() => {
    async function fetchSignedUrl() {
      if (!receiptPath || !isOpen) return;
      setIsLoading(true);
      try {
        let path = receiptPath;
        if (path.includes("/public/payment-receipts/")) {
          path = path.split("/public/payment-receipts/")[1];
        } else if (path.includes("/payment-receipts/")) {
          path = path.split("/payment-receipts/")[1];
        }

        const supabase = createClient();
        const { data } = await supabase.storage.from("payment-receipts").createSignedUrl(path, 3600);
        
        if (data?.signedUrl) {
          setSignedUrl(data.signedUrl);
        } else {
          setSignedUrl(receiptPath);
        }
      } catch (err) {
        console.error("Failed to load receipt:", err);
        setSignedUrl(receiptPath); // Fallback
      } finally {
        setIsLoading(false);
      }
    }

    setSignedUrl(null);
    fetchSignedUrl();
  }, [receiptPath, isOpen]);

  if (!booking) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white border-zinc-200">
        <DialogHeader className="px-6 py-5 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Receipt className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-neutral-900 leading-none">
                  Payment Submitted
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-neutral-500 mt-1">
                  Your deposit is pending verification.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* GCash Reference Number */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Hash className="h-5 w-5 text-neutral-400" />
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-0.5">GCash Reference</p>
                <p className="text-sm font-mono font-bold text-neutral-900">{gcashReference}</p>
              </div>
            </div>
          </div>

          {/* Screenshot Preview */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-neutral-700">Uploaded Screenshot</p>
            <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 flex items-center justify-center">
              {isLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-neutral-400 animate-spin" />
                  <span className="text-xs font-medium text-neutral-500">Loading receipt...</span>
                </div>
              ) : signedUrl ? (
                <Image 
                  src={signedUrl} 
                  alt="GCash Receipt" 
                  fill 
                  className="object-contain p-2"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              ) : (
                <div className="text-xs text-neutral-500">Preview not available</div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
