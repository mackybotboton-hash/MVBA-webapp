"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, X, CheckCircle, Copy } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export type TransactionItem = {
  id: string;
  guest_name: string;
  property_name: string;
  total_price: number;
  downpayment_amount: number;
  commission_amount: number;
  host_payout_amount: number;
  payment_status: "awaiting_deposit" | "deposit_uploaded" | "verified" | "completed" | "refunded";
  payout_status: string;
  status: string;
  receipt_url?: string;
  created_at: string;
  host_gcash_number?: string;
  host_name?: string;
};

interface VerifyModalProps {
  transaction: TransactionItem | null;
  onClose: () => void;
  onVerify: (id: string) => Promise<void>;
  isVerifying: boolean;
}

export function VerifyModal({ transaction, onClose, onVerify, isVerifying }: VerifyModalProps) {
  const [signedReceiptUrl, setSignedReceiptUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadReceipt() {
      if (!transaction?.receipt_url) return;
      
      const rawUrl = transaction.receipt_url;
      let path = rawUrl.includes("|") ? rawUrl.split("|")[0] : rawUrl;
      
      let storagePath = path;
      if (storagePath.includes("/public/payment-receipts/")) {
        storagePath = storagePath.split("/public/payment-receipts/")[1];
      } else if (storagePath.includes("/payment-receipts/")) {
        storagePath = storagePath.split("/payment-receipts/")[1];
      } else if (storagePath.startsWith("payment-receipts/")) {
        storagePath = storagePath.replace("payment-receipts/", "");
      }
      
      try {
        const supabase = createClient();
        const { data } = await supabase.storage.from("payment-receipts").createSignedUrl(storagePath, 3600);
        if (data?.signedUrl) {
          setSignedReceiptUrl(data.signedUrl);
        } else {
          setSignedReceiptUrl(path);
        }
      } catch {
        setSignedReceiptUrl(path);
      }
    }
    
    setSignedReceiptUrl(null);
    if (transaction) {
      loadReceipt();
    }
  }, [transaction]);

  if (!transaction) return null;

  const handleCopy = () => {
    if (transaction.host_gcash_number) {
      navigator.clipboard.writeText(transaction.host_gcash_number);
      toast.success("GCash number copied!");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-4xl w-full rounded-2xl overflow-hidden shadow-2xl bg-white flex flex-col md:flex-row max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        
        {/* Left Side: Receipt Image */}
        <div className="w-full md:w-1/2 relative bg-neutral-100 flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 bg-white/50 backdrop-blur-sm absolute top-0 w-full z-10 md:hidden">
            <h3 className="font-bold text-neutral-900 text-sm">Verify Deposit</h3>
            <button onClick={onClose} className="p-1 text-neutral-500 hover:text-black"><X className="h-5 w-5" /></button>
          </div>
          
          <div className="flex-1 min-h-[300px] md:min-h-[500px] relative p-4 flex items-center justify-center pt-14 md:pt-4">
            {signedReceiptUrl ? (
              <Image 
                src={signedReceiptUrl} 
                alt="Receipt" 
                fill 
                sizes="(max-width: 768px) 100vw, 50vw" 
                className="object-contain p-4" 
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-neutral-500" />
                <p className="text-sm text-neutral-500 font-medium">Loading receipt...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Action Panel */}
        <div className="w-full md:w-1/2 bg-white flex flex-col border-l border-neutral-200">
          <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50">
            <h3 className="font-bold text-neutral-900 text-base">Verify & Disburse</h3>
            <button onClick={onClose} className="p-1.5 rounded-full text-neutral-500 hover:bg-neutral-200 hover:text-black transition-colors"><X className="h-5 w-5" /></button>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">Transaction Details</h4>
              <div className="space-y-3 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
                <div className="flex justify-between">
                  <span className="text-sm text-neutral-600">Booking ID</span>
                  <span className="text-sm font-medium text-neutral-900">#{transaction.id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-neutral-600">Guest Name</span>
                  <span className="text-sm font-medium text-neutral-900">{transaction.guest_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-neutral-600">Property</span>
                  <span className="text-sm font-medium text-neutral-900">{transaction.property_name}</span>
                </div>
                <div className="pt-2 mt-2 border-t border-neutral-200 flex justify-between">
                  <span className="text-sm font-semibold text-neutral-900">Collected Deposit</span>
                  <span className="text-sm font-bold text-neutral-900">₱{transaction.downpayment_amount}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">Disbursement Info (Host)</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  <span className="text-sm font-semibold text-blue-900">Host Payout Amount</span>
                  <span className="text-lg font-bold text-blue-700">₱{transaction.host_payout_amount}</span>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-neutral-600">Host GCash Number</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-neutral-100 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm font-mono font-medium text-neutral-900">
                      {transaction.host_gcash_number || "Not provided"}
                    </div>
                    <Button 
                      variant="outline" 
                      className="shrink-0"
                      onClick={handleCopy}
                      disabled={!transaction.host_gcash_number}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  {transaction.host_name && (
                    <p className="text-xs text-neutral-500 mt-1">Host Profile Name: {transaction.host_name}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-neutral-200 bg-neutral-50 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isVerifying}>
              Cancel
            </Button>
            <Button 
              className="bg-black text-white hover:bg-neutral-800" 
              onClick={() => onVerify(transaction.id)}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Deposit
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const getColumns = (
  onVerifyClick: (t: TransactionItem) => void,
  onMarkPaidClick: (id: string) => void
): ColumnDef<TransactionItem>[] => [
  {
    accessorKey: "id",
    header: "Booking ID & Guest",
    cell: ({ row }) => {
      const id = row.original.id;
      const guest = row.original.guest_name;
      return (
        <div>
          <p className="font-bold text-neutral-900 text-sm">#{id.slice(0, 8)}</p>
          <p className="text-neutral-700 font-medium text-xs mt-0.5">{guest}</p>
        </div>
      );
    },
  },
  {
    accessorKey: "property_name",
    header: "Property",
    cell: ({ row }) => <div className="text-neutral-700 font-medium text-sm">{row.getValue("property_name")}</div>,
  },
  {
    id: "financials",
    header: "Financials",
    cell: ({ row }) => {
      const total = row.original.total_price;
      const deposit = row.original.downpayment_amount;
      const commission = row.original.commission_amount;
      const payout = row.original.host_payout_amount;
      return (
        <div className="space-y-1">
          <p className="text-xs font-medium text-neutral-700">Total: ₱{total}</p>
          <p className="text-xs text-neutral-900 font-bold">Deposit: ₱{deposit}</p>
          <p className="text-[10px] font-medium text-green-700">Platform (8%): ₱{commission}</p>
          <p className="text-[10px] font-medium text-blue-700">Host (12%): ₱{payout}</p>
        </div>
      );
    },
  },
  {
    accessorKey: "payment_status",
    header: "Deposit Status",
    cell: ({ row }) => {
      const status = row.getValue("payment_status") as string;
      return (
        <Badge variant={status === "verified" ? "success" : status === "deposit_uploaded" ? "warning" : "default"} size="sm" className="capitalize">
          {status.replace("_", " ")}
        </Badge>
      );
    },
  },
  {
    accessorKey: "payout_status",
    header: "Payout Status",
    cell: ({ row }) => {
      const status = row.getValue("payout_status") as string;
      return (
        <Badge variant={status === "paid" ? "success" : "warning"} size="sm" className="capitalize">
          {status}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => {
      const t = row.original;
      return (
        <div className="flex flex-col items-end gap-2">
          {t.payment_status === "deposit_uploaded" && t.receipt_url && (
            <Button size="sm" onClick={() => onVerifyClick(t)} className="bg-black text-white hover:bg-neutral-800 text-xs">
              Verify Receipt
            </Button>
          )}
          {t.payment_status === "verified" && t.payout_status === "pending" && (
            <Button size="sm" variant="outline" onClick={() => onMarkPaidClick(t.id)} className="border-blue-200 text-blue-600 hover:bg-blue-50 text-xs">
              Mark Payout Paid
            </Button>
          )}
        </div>
      );
    },
  },
];
