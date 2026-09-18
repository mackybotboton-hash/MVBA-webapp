"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, Image as ImageIcon, X, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// 1. RECEIPT UPLOAD DIALOG (Standard Component)
// ============================================================================

interface GCashDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  onUploadComplete: (payload: { receiptFile: File; referenceNumber: string }) => Promise<void>;
}

export function GCashDepositModal({ isOpen, onClose, bookingId, onUploadComplete }: GCashDepositModalProps) {
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

export const ReceiptUploadDialog = GCashDepositModal;

