"use client";

import * as React from "react";
import { toast } from "sonner";
import { X, UploadCloud, CheckCircle2, QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { type BookingData } from "./booking-card";
import Image from "next/image";

interface GCashDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingData | null;
  onSuccess: () => void;
}

export function GCashDepositModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
}: GCashDepositModalProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  // Hardcoded central association GCash details for demo purposes
  const GCASH_NUMBER = "0917-123-4567";
  const GCASH_NAME = "MVBA Association";

  React.useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreview(null);
      setIsUploading(false);
    }
  }, [isOpen]);

  if (!isOpen || !booking) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 5 * 1024 * 1024) {
        toast.error("File is too large. Max size is 5MB.");
        return;
      }
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a screenshot to upload.");
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      // Upload image to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${booking.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("payment-receipts")
        .upload(fileName, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("Failed to upload receipt image.");
      }

      // Get public URL (or just save the path if bucket is private)
      const { data: { publicUrl } } = supabase.storage
        .from("payment-receipts")
        .getPublicUrl(fileName);

      // Update the booking record
      const { error: updateError } = await (supabase.from("bookings") as any)
        .update({
          payment_status: "deposit_uploaded",
          receipt_url: publicUrl,
        })
        .eq("id", booking.id);

      if (updateError) {
        console.error("Update error:", updateError);
        throw new Error("Failed to update booking status.");
      }

      toast.success("Deposit receipt uploaded successfully!", {
        description: "The admin will verify your payment shortly.",
      });
      
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-md w-full rounded-2xl overflow-hidden shadow-2xl bg-white border border-neutral-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 bg-neutral-50 sticky top-0 z-10">
          <div>
            <h3 className="font-bold text-neutral-900 text-base">Pay Reservation Deposit</h3>
            <p className="text-[11px] text-neutral-600">
              Booking #{booking.id.slice(0, 8)} • {booking.property_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
            <div className="mt-0.5">
              <QrCode className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-900">Required Downpayment</p>
              <p className="text-xs text-blue-700 mt-1">
                Please send exactly <strong className="font-bold text-blue-900">₱{booking.downpayment_amount?.toLocaleString() || 0}</strong> via GCash to lock in your reservation.
              </p>
            </div>
          </div>

          {/* GCash Details */}
          <div className="rounded-xl border border-neutral-200 p-4 bg-white text-center">
            <p className="text-xs font-semibold text-neutral-600 uppercase tracking-widest mb-2">Send GCash To</p>
            <p className="text-2xl font-black text-neutral-900 tracking-tight">{GCASH_NUMBER}</p>
            <p className="text-sm font-medium text-neutral-600 mt-1">{GCASH_NAME}</p>
          </div>

          {/* Upload Area */}
          <div>
            <p className="text-sm font-semibold text-neutral-900 mb-2">Upload Screenshot</p>
            {!preview ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-neutral-200 border-dashed rounded-xl cursor-pointer bg-neutral-50 hover:bg-neutral-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className="h-8 w-8 text-neutral-500 mb-2" />
                  <p className="text-sm font-medium text-neutral-600">Click to upload screenshot</p>
                  <p className="text-xs text-neutral-500 mt-1">PNG, JPG (Max 5MB)</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleFileChange}
                />
              </label>
            ) : (
              <div className="relative w-full aspect-[3/4] bg-neutral-100 rounded-xl overflow-hidden border border-neutral-200">
                <Image src={preview} alt="Receipt preview" fill className="object-contain" />
                <button
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white backdrop-blur-md transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-neutral-200 bg-white sticky bottom-0 z-10 flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
            disabled={!file || isUploading}
            onClick={handleUpload}
          >
            {isUploading ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                Uploading...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Submit Receipt
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
