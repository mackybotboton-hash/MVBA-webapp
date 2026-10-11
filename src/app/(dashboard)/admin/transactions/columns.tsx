"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, X, CheckCircle, Copy } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { calculatePayout } from "@/lib/payout-helper";

export type TransactionItem = {
  id: string;
  guest_name: string;
  property_name: string;
  total_price: number;
  downpayment_amount: number;
  commission_amount: number;
  host_payout_amount: number;
  convenience_fee: number;
  payment_status: "awaiting_deposit" | "deposit_uploaded" | "verified" | "completed" | "refunded";
  payout_status: string;
  deposit_payout_amount?: number | null;
  status: string;
  receipt_url?: string;
  created_at: string;
  check_in?: string;
  check_out?: string;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative max-w-4xl w-full rounded-2xl overflow-hidden shadow-2xl bg-white flex flex-col md:flex-row max-h-[90dvh] h-[90dvh]" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header for Mobile */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 bg-white shrink-0 md:hidden">
          <h3 className="font-bold text-neutral-900 text-sm">Verify Deposit</h3>
          <button onClick={onClose} className="p-1 text-neutral-500 hover:text-black">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Left Side: Receipt Image */}
        <div className="w-full md:w-1/2 bg-neutral-100 flex flex-col shrink-0 md:shrink md:h-full overflow-hidden border-b md:border-b-0 md:border-r border-neutral-200">
          <div className="relative w-full h-[220px] sm:h-[280px] md:h-full p-4 flex items-center justify-center">
            {signedReceiptUrl ? (
              <Image 
                src={signedReceiptUrl} 
                alt="Receipt" 
                fill 
                sizes="(max-width: 768px) 100vw, 50vw" 
                className="object-contain p-2 sm:p-4" 
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
        <div className="w-full md:w-1/2 bg-white flex flex-col flex-1 min-h-0">
          <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50 shrink-0">
            <h3 className="font-bold text-neutral-900 text-base">Verify Deposit</h3>
            <button onClick={onClose} className="p-1.5 rounded-full text-neutral-500 hover:bg-neutral-200 hover:text-black transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Scrollable Content */}
          <div className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-5 min-h-0">
            <div>
              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2.5">Transaction Details</h4>
              <div className="space-y-2.5 bg-neutral-50 p-3.5 sm:p-4 rounded-xl border border-neutral-100">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-neutral-600">Booking ID</span>
                  <span className="font-medium text-neutral-900">#{transaction.id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-neutral-600">Guest Name</span>
                  <span className="font-medium text-neutral-900">{transaction.guest_name}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-neutral-600">Property</span>
                  <span className="font-medium text-neutral-900">{transaction.property_name}</span>
                </div>
                <div className="pt-2 mt-1 border-t border-neutral-200 flex justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-neutral-900">Collected Deposit</span>
                  <span className="font-bold text-neutral-900">₱{transaction.downpayment_amount}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2.5">Disbursement Info (Host)</h4>
              <div className="space-y-3">
                {(() => {
                  const payouts = calculatePayout({
                    totalPrice: transaction.total_price,
                    downpaymentAmount: transaction.downpayment_amount,
                    commissionAmount: transaction.commission_amount,
                    convenienceFee: transaction.convenience_fee,
                  });
                  return (
                    <div className="flex justify-between items-center bg-blue-50/50 p-3.5 sm:p-4 rounded-xl border border-blue-100">
                      <span className="text-xs sm:text-sm font-semibold text-blue-900">Deposit Payout (Host Share)</span>
                      <span className="text-base sm:text-lg font-bold text-blue-700">₱{payouts.depositPayout}</span>
                    </div>
                  );
                })()}
                
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-600">Host GCash Number</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-neutral-100 border border-neutral-200 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono font-medium text-neutral-900">
                      {transaction.host_gcash_number || "Not provided"}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="shrink-0 h-9"
                      onClick={handleCopy}
                      disabled={!transaction.host_gcash_number}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="p-4 sm:p-5 border-t border-neutral-200 bg-neutral-50 flex justify-end gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isVerifying}>
              Cancel
            </Button>
            <Button 
              size="sm"
              className="bg-black text-white hover:bg-neutral-800" 
              onClick={() => onVerify(transaction.id)}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
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

export function DepositStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={
        status === "verified"
          ? "success"
          : status === "refunded"
          ? "destructive"
          : status === "deposit_uploaded"
          ? "warning"
          : "default"
      }
      size="sm"
      className="capitalize"
    >
      {status.replace("_", " ")}
    </Badge>
  );
}

export function PayoutStatusBadge({ status }: { status?: string | null }) {
  const s = status || "unpaid";
  return (
    <Badge 
      variant={s === "fully_paid" ? "success" : s === "deposit_paid" ? "outline" : "warning"} 
      size="sm" 
      className="capitalize"
    >
      {s.replace("_", " ")}
    </Badge>
  );
}

export function TransactionActions({
  transaction,
  onVerifyClick,
  onMarkPaidClick,
  onMarkRefundedClick,
  mode = "all",
}: {
  transaction: TransactionItem;
  onVerifyClick: (t: TransactionItem) => void;
  onMarkPaidClick: (t: TransactionItem, stage: "deposit" | "balance") => void;
  onMarkRefundedClick?: (t: TransactionItem) => void;
  mode?: "primary" | "secondary" | "all";
}) {
  const t = transaction;
  const isDepositUploaded = t.payment_status === "deposit_uploaded" && !!t.receipt_url;
  const isPayoutDue = t.payment_status === "verified" && (!t.payout_status || t.payout_status === "pending");
  const isCancelledVerified = t.status === "cancelled" && t.payment_status === "verified" && !!onMarkRefundedClick;
  const hasReceiptToView = !!t.receipt_url && !isDepositUploaded;

  if (mode === "primary") {
    if (isDepositUploaded) {
      return (
        <Button 
          size="sm" 
          onClick={(e) => { e.stopPropagation(); onVerifyClick(t); }} 
          className="bg-black text-white hover:bg-neutral-800 text-xs h-8 px-3"
        >
          Verify Receipt
        </Button>
      );
    }
    if (isPayoutDue) {
      return (
        <Button 
          size="sm" 
          variant="outline" 
          onClick={(e) => { e.stopPropagation(); onMarkPaidClick(t, "deposit"); }} 
          className="border-blue-200 text-blue-600 hover:bg-blue-50 text-xs h-8 px-3"
        >
          Mark Deposit Payout
        </Button>
      );
    }
    if (isCancelledVerified) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => { e.stopPropagation(); onMarkRefundedClick!(t); }}
          className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-8 px-3"
        >
          Mark as Refunded
        </Button>
      );
    }
    if (hasReceiptToView) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => { e.stopPropagation(); onVerifyClick(t); }}
          className="border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs h-8 px-3"
        >
          View Receipt
        </Button>
      );
    }
    return null;
  }

  if (mode === "secondary") {
    return (
      <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {hasReceiptToView && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onVerifyClick(t)}
            className="border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs h-8 px-3"
          >
            View Receipt
          </Button>
        )}
        {isCancelledVerified && !isDepositUploaded && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onMarkRefundedClick!(t)}
            className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-8 px-3"
          >
            Mark as Refunded
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      {isDepositUploaded && (
        <Button size="sm" onClick={() => onVerifyClick(t)} className="bg-black text-white hover:bg-neutral-800 text-xs">
          Verify Receipt
        </Button>
      )}
      {isPayoutDue && (
        <Button size="sm" variant="outline" onClick={() => onMarkPaidClick(t, "deposit")} className="border-blue-200 text-blue-600 hover:bg-blue-50 text-xs">
          Mark Deposit Payout
        </Button>
      )}
      {/* Balance payout button hidden in new commission-only model where hosts collect directly */}
      {isCancelledVerified && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onMarkRefundedClick!(t)}
          className="border-red-200 text-red-600 hover:bg-red-50 text-xs"
        >
          Mark as Refunded
        </Button>
      )}
    </div>
  );
}

export const getColumns = (
  onVerifyClick: (t: TransactionItem) => void,
  onMarkPaidClick: (t: TransactionItem, stage: "deposit" | "balance") => void,
  onMarkRefundedClick?: (t: TransactionItem) => void
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
      const fee = row.original.convenience_fee;
      const commission = row.original.commission_amount;
      
      const payouts = calculatePayout({
        totalPrice: total,
        downpaymentAmount: deposit,
        commissionAmount: commission,
        convenienceFee: fee,
        depositPayoutAmount: row.original.deposit_payout_amount,
      });
      
      const depositHostPayout = payouts.depositPayout;
      const balanceHostPayout = payouts.balancePayout;
      
      return (
        <div className="space-y-1">
          <p className="text-xs font-medium text-neutral-700">Total: ₱{total}</p>
          <p className="text-xs text-neutral-900 font-bold">Deposit: ₱{deposit} (Fee: ₱{fee})</p>
          <p className="text-[10px] font-medium text-green-700">Total Comm: ₱{commission}</p>
          <p className="text-[10px] font-medium text-blue-700">Host Deposit: ₱{depositHostPayout}</p>
          <p className="text-[10px] font-medium text-amber-700">Collected from guest at check-in: ₱{balanceHostPayout}</p>
        </div>
      );
    },
  },
  {
    accessorKey: "payment_status",
    header: "Deposit Status",
    cell: ({ row }) => <DepositStatusBadge status={row.getValue("payment_status") as string} />,
  },
  {
    accessorKey: "payout_status",
    header: "Payout Status",
    cell: ({ row }) => <PayoutStatusBadge status={row.getValue("payout_status") as string} />,
  },
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => (
      <TransactionActions
        transaction={row.original}
        onVerifyClick={onVerifyClick}
        onMarkPaidClick={onMarkPaidClick}
        onMarkRefundedClick={onMarkRefundedClick}
        mode="all"
      />
    ),
  },
];
