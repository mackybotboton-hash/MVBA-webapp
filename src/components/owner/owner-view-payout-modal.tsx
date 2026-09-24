"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface OwnerViewPayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptPath: string | null;
}

export function OwnerViewPayoutModal({ isOpen, onClose, receiptPath }: OwnerViewPayoutModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !receiptPath) {
      setImageUrl(null);
      return;
    }

    const supabase = createClient();
    const { data } = supabase.storage.from("payment-receipts").getPublicUrl(receiptPath);
    setImageUrl(data.publicUrl);
  }, [isOpen, receiptPath]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] border-zinc-200 p-0 overflow-hidden bg-white">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-medium">Payout Receipt</DialogTitle>
          <DialogDescription className="text-zinc-500">
            This is the proof of payout sent by the admin via GCash.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-2 flex flex-col gap-4">
          <div className="relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-50 aspect-[3/4] w-full flex items-center justify-center">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Payout receipt" className="object-contain w-full h-full" />
            ) : (
              <ImageIcon className="w-12 h-12 text-zinc-300" />
            )}
          </div>

          <Button 
            variant="outline" 
            className="w-full rounded-xl py-6 text-base font-medium"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
