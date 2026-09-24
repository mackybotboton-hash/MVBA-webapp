"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UploadCloud, Image as ImageIcon, X, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface AdminPayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  hostName?: string;
  hostGcashNumber?: string;
  payoutAmount?: number;
  onUploadComplete: (payload: { receiptFile: File }) => Promise<void>;
}

export function AdminPayoutModal({ 
  isOpen, 
  onClose, 
  bookingId, 
  hostName, 
  hostGcashNumber, 
  payoutAmount, 
  onUploadComplete 
}: AdminPayoutModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
      toast.error("Please upload a payout receipt screenshot.");
      return;
    }

    setIsUploading(true);
    try {
      await onUploadComplete({ receiptFile: file });
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
        setIsSuccess(false);
        handleRemoveFile();
      }, 2000);
    } catch (error) {
      toast.error("Failed to upload receipt. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] border-zinc-200 p-0 overflow-hidden bg-white">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-medium">Verify Payout Paid</DialogTitle>
          <DialogDescription className="text-zinc-500">
            Upload the GCash receipt showing you have disbursed the funds to the host.
          </DialogDescription>
        </DialogHeader>

        {payoutAmount !== undefined && (
          <div className="px-6 py-4 bg-blue-50 border-y border-blue-100 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Host details</span>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-blue-900">
                  {hostName || "Host Name Not Provided"}
                </p>
                <p className="text-xs font-medium text-blue-700/80">
                  GCash: {hostGcashNumber || "N/A"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Amount</p>
                <p className="text-lg font-bold text-blue-700">₱{payoutAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6">
          <div className="space-y-3">
            <Label className="text-zinc-700 font-medium">Payout Screenshot</Label>
            
            <AnimatePresence mode="wait">
              {!file ? (
                <motion.div
                  key="dropzone"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors
                    ${isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100/50 hover:border-zinc-300'}
                  `}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/jpeg, image/png, image/webp"
                    onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                  />
                  <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center border border-zinc-100">
                    <UploadCloud className="w-6 h-6 text-zinc-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-900">Click to upload or drag and drop</p>
                    <p className="text-xs text-zinc-500 mt-1">JPG, PNG or WEBP (max. 5MB)</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-50 group"
                >
                  <div className="aspect-[4/3] w-full relative bg-zinc-100 flex items-center justify-center">
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewUrl} alt="Receipt preview" className="object-contain w-full h-full" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-zinc-300" />
                    )}
                  </div>
                  
                  {!isUploading && !isSuccess && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Button
                         type="button"
                        variant="destructive"
                        size="icon"
                        className="rounded-full shadow-lg"
                        onClick={handleRemoveFile}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button 
            type="submit" 
            className="w-full rounded-xl py-6 text-base font-medium shadow-sm transition-all relative overflow-hidden"
            disabled={!file || isUploading || isSuccess}
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
                  Submit Payout Receipt
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
