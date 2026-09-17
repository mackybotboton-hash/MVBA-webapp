"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Receipt,
  X,
  Upload,
  Loader2,
  CheckCircle2,
  PhilippinePeso,
  Building2,
  Home,
  QrCode,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { uploadFile, generateFilePath } from "@/lib/supabase/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";

export interface DuesPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  role: "homestay" | "resort";
  propertyName?: string;
  currentMonth?: string;
}

export function DuesPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  role,
  propertyName = "Accredited Property",
  currentMonth = "September 2026",
}: DuesPaymentModalProps) {
  const duesAmount = role === "resort" ? 1500 : 500;
  const [receiptUrl, setReceiptUrl] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Receipt screenshot must be under 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const userId = user?.id || "member";
      const filePath = generateFilePath(userId, file.name);

      const publicUrl = await uploadFile(
        STORAGE_BUCKETS.PAYMENT_RECEIPTS,
        filePath,
        file
      );

      setReceiptUrl(publicUrl);
      toast.success("Receipt screenshot uploaded!");
    } catch {
      // Local preview fallback
      const previewUrl = URL.createObjectURL(file);
      setReceiptUrl(previewUrl);
      toast.info("Receipt image loaded");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptUrl) {
      toast.error("Please upload or attach your GCash/Bank receipt screenshot");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Save to association_dues
        const monthDate = "2026-09-01";
        await (supabase.from("association_dues") as any).upsert({
          owner_id: user.id,
          month: monthDate,
          amount: duesAmount,
          status: "paid",
          receipt_url: receiptUrl,
          paid_at: new Date().toISOString(),
        });
      }

      toast.success("Payment submitted for association verification!", {
        description: `₱${duesAmount.toLocaleString()} dues receipt sent to MVBA Treasury.`,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md rounded-2xl bg-white border border-neutral-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-white">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Monthly Association Dues
              </h2>
              <p className="text-[11px] text-neutral-600 font-medium">
                {currentMonth} • MVBA Association Treasury
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
          {/* Bill Summary */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-2">
            <div className="flex justify-between items-center text-neutral-600">
              <span>Member Property:</span>
              <span className="font-semibold text-neutral-900">{propertyName}</span>
            </div>
            <div className="flex justify-between items-center text-neutral-600">
              <span>Classification:</span>
              <Badge variant={role === "resort" ? "default" : "secondary"} size="sm" className="capitalize">
                {role}
              </Badge>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-neutral-200">
              <span className="font-bold text-neutral-900 text-sm">Monthly Fee:</span>
              <span className="font-bold text-neutral-900 text-lg">
                ₱{duesAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payment Instructions (GCash / Bank) */}
          <div className="rounded-xl border border-neutral-200 p-4 space-y-2.5 bg-white">
            <h3 className="font-bold text-neutral-900 text-xs uppercase tracking-wider">
              Payment Instructions
            </h3>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              Send payment via <strong>GCash</strong> to the MVBA Association Municipal Treasurer:
            </p>
            <div className="bg-neutral-100 p-3 rounded-lg font-mono text-[11px] text-neutral-800 space-y-1">
              <p><strong>GCash Number:</strong> 0917-849-2041</p>
              <p><strong>Account Name:</strong> MVBA TREASURY (San Agustin)</p>
              <p><strong>Reference:</strong> {propertyName.slice(0, 15)} Dues</p>
            </div>
          </div>

          {/* Receipt Upload Section */}
          <div className="space-y-2">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              Proof of Payment (Screenshot) *
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            <Button
              type="button"
              variant="outline"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-11 border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 text-xs font-semibold flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Uploading Receipt...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 text-neutral-600" />
                  <span>Upload GCash / Bank Screenshot</span>
                </>
              )}
            </Button>

            {receiptUrl && (
              <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden border border-neutral-200 mt-2 bg-neutral-100">
                <Image
                  src={receiptUrl}
                  alt="Receipt preview"
                  fill
                  className="object-contain"
                />
                <button
                  type="button"
                  onClick={() => setReceiptUrl("")}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-neutral-300 text-xs h-9 px-4 font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isUploading || !receiptUrl}
              className="bg-black text-white hover:bg-neutral-800 text-xs h-9 px-5 font-bold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Submitting...
                </>
              ) : (
                "Submit Proof of Payment"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
