"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, Image as ImageIcon, X, Loader2, CheckCircle2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { type BookingData } from "./booking-card";
import Image from "next/image";

// ============================================================================
// 1. RECEIPT UPLOAD DIALOG (Standard Component)
// ============================================================================

interface ReceiptUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  onUploadComplete: (payload: { receiptFile: File; referenceNumber: string }) => Promise<void>;
}

export function ReceiptUploadDialog({ isOpen, onClose, bookingId, onUploadComplete }: ReceiptUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (selectedFile: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error("Invalid file type. Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 5MB.");
      return;
    }

    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please upload a receipt screenshot.");
      return;
    }
    
    const sanitizedRef = referenceNumber.replace(/\D/g, '');
    if (sanitizedRef.length < 10) {
      toast.error("Please enter a valid GCash reference number.");
      return;
    }

    setIsUploading(true);
    try {
      await onUploadComplete({ receiptFile: file, referenceNumber: sanitizedRef });
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
        setIsSuccess(false);
        handleRemoveFile();
        setReferenceNumber("");
      }, 2000);
    } catch {
      toast.error("Failed to upload receipt. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px] p-6 bg-white border border-neutral-200 rounded-3xl shadow-xl">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold text-neutral-900 tracking-tight">Upload Payment Receipt</DialogTitle>
          <DialogDescription className="text-sm text-neutral-500">
            Booking #{bookingId ? bookingId.slice(0, 8) : ""} • Send downpayment via GCash and upload your confirmation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="referenceNumber" className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
              GCash Reference No.
            </Label>
            <Input
              id="referenceNumber"
              placeholder="e.g. 1002 9384 19283"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="rounded-xl border-neutral-200 focus:border-black focus:ring-black h-11"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
              Proof of Payment
            </Label>
            
            {!previewUrl ? (
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  isDragging ? "border-black bg-neutral-50" : "border-neutral-200 hover:border-neutral-300 bg-neutral-50/50"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-500 mb-2">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-neutral-700">Click to upload or drag and drop</p>
                <p className="text-xs text-neutral-400 mt-1">PNG, JPG or WEBP (max 5MB)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
            ) : (
              <div className="relative rounded-2xl border border-neutral-200 overflow-hidden bg-neutral-50 p-2">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden relative border border-neutral-200 flex-shrink-0">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{file?.name}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{file ? (file.size / 1024 / 1024).toFixed(2) : 0} MB</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveFile}
                    className="h-8 w-8 text-neutral-400 hover:text-neutral-700 rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-black text-white hover:bg-neutral-800 rounded-xl h-11 font-medium transition-all"
            disabled={!file || !referenceNumber || isUploading || isSuccess}
          >
            <AnimatePresence mode="wait">
              {isUploading ? (
                <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading...
                </motion.div>
              ) : isSuccess ? (
                <motion.div key="success" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="w-5 h-5" />
                  Verified
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Submit Payment
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// 2. GCASH DEPOSIT MODAL (Tourist Bookings Flow Component)
// ============================================================================

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
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const GCASH_NUMBER = "0917-123-4567";
  const GCASH_NAME = "MVBA Association";

  useEffect(() => {
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

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${booking.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-receipts")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("payment-receipts").getPublicUrl(fileName);

      const { error: updateError } = await (supabase.from("bookings") as any)
        .update({
          payment_status: "deposit_uploaded",
          receipt_url: publicUrl,
        })
        .eq("id", booking.id);

      if (updateError) {
        throw new Error("Failed to update booking status.");
      }

      toast.success("Deposit receipt uploaded successfully!", {
        description: "The host and admin will verify your payment shortly.",
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

          <div className="rounded-xl border border-neutral-200 p-4 bg-white text-center">
            <p className="text-xs font-semibold text-neutral-600 uppercase tracking-widest mb-2">Send GCash To</p>
            <p className="text-2xl font-black text-neutral-900 tracking-tight">{GCASH_NUMBER}</p>
            <p className="text-sm font-medium text-neutral-600 mt-1">{GCASH_NAME}</p>
          </div>

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
