"use client";

import * as React from "react";
import { toast } from "sonner";
import { Receipt, RefreshCw, X, Briefcase, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { verifyDepositAction, markPayoutPaidAction } from "@/app/actions/admin-transactions";

interface TransactionItem {
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
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = React.useState<TransactionItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"all" | "verifying" | "verified" | "paid" | "cancelled">("all");
  const [previewTransaction, setPreviewTransaction] = React.useState<TransactionItem | null>(null);
  const [signedReceiptUrl, setSignedReceiptUrl] = React.useState<string | null>(null);

  const handleViewReceipt = async (t: TransactionItem) => {
    setPreviewTransaction(t);
    if (!t.receipt_url) return;
    
    let path = t.receipt_url;
    if (path.includes("/public/payment-receipts/")) {
      path = path.split("/public/payment-receipts/")[1];
    } else if (path.includes("/payment-receipts/")) {
      path = path.split("/payment-receipts/")[1];
    }
    
    try {
      const supabase = createClient();
      const { data } = await supabase.storage.from("payment-receipts").createSignedUrl(path, 3600);
      if (data?.signedUrl) {
        setSignedReceiptUrl(data.signedUrl);
      } else {
        setSignedReceiptUrl(t.receipt_url);
      }
    } catch {
      setSignedReceiptUrl(t.receipt_url);
    }
  };

  const fetchTransactions = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
          total_price,
          downpayment_amount,
          commission_amount,
          host_payout_amount,
          payment_status,
          payout_status,
          status,
          receipt_url,
          created_at,
          profiles!tourist_id (full_name),
          rooms (
            properties (name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load transactions:", error);
      } else if (data && data.length > 0) {
        const mapped = data.map((d: any) => ({
          id: d.id,
          guest_name: d.profiles?.full_name || "Guest",
          property_name: d.rooms?.properties?.name || "Property",
          total_price: Number(d.total_price),
          downpayment_amount: Number(d.downpayment_amount),
          commission_amount: Number(d.commission_amount),
          host_payout_amount: Number(d.host_payout_amount),
          payment_status: d.payment_status || "awaiting_deposit",
          payout_status: d.payout_status || "pending",
          status: d.status,
          receipt_url: d.receipt_url,
          created_at: d.created_at,
        }));
        setTransactions(mapped);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleVerify = async (id: string) => {
    try {
      const res = await verifyDepositAction(id);
      if (!res.success) throw new Error(res.error);
      
      setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, payment_status: "verified" } : t)));
      toast.success("Deposit verified!");
      setPreviewTransaction(null);
      setSignedReceiptUrl(null);
    } catch (err: any) {
      toast.error("Failed to verify deposit: " + err.message);
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      const res = await markPayoutPaidAction(id);
      if (!res.success) throw new Error(res.error);
      
      setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, payout_status: "paid" } : t)));
      toast.success("Payout marked as paid!");
    } catch (err: any) {
      toast.error("Failed to update payout status: " + err.message);
    }
  };

  const filteredTransactions = React.useMemo(() => {
    if (activeTab === "all") return transactions.filter(t => t.status !== "cancelled" && t.status !== "declined");
    if (activeTab === "verifying") return transactions.filter(t => t.payment_status === "deposit_uploaded" && t.status !== "cancelled");
    if (activeTab === "verified") return transactions.filter(t => t.payment_status === "verified" && t.payout_status !== "paid" && t.status !== "cancelled");
    if (activeTab === "paid") return transactions.filter(t => t.payout_status === "paid" && t.status !== "cancelled");
    if (activeTab === "cancelled") return transactions.filter(t => t.status === "cancelled" || t.status === "declined");
    return transactions;
  }, [transactions, activeTab]);

  const counts = React.useMemo(() => {
    return {
      all: transactions.filter(t => t.status !== "cancelled" && t.status !== "declined").length,
      verifying: transactions.filter(t => t.payment_status === "deposit_uploaded" && t.status !== "cancelled").length,
      verified: transactions.filter(t => t.payment_status === "verified" && t.payout_status !== "paid" && t.status !== "cancelled").length,
      paid: transactions.filter(t => t.payout_status === "paid" && t.status !== "cancelled").length,
      cancelled: transactions.filter(t => t.status === "cancelled" || t.status === "declined").length,
    };
  }, [transactions]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Commissions & Payouts</h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1 font-medium">Verify GCash deposits and manage host payouts.</p>
        </div>
        <button onClick={fetchTransactions} className="p-2 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-600 transition-colors">
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Status Segment Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide border-b border-neutral-200 pb-2">
        {[
          { id: "verifying", label: "To Verify", count: counts.verifying },
          { id: "verified", label: "Ready for Payout", count: counts.verified },
          { id: "paid", label: "Paid Out", count: counts.paid },
          { id: "all", label: "Active Transactions", count: counts.all },
          { id: "cancelled", label: "Cancelled", count: counts.cancelled },
        ].map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 select-none ${
                isSelected
                  ? "bg-black text-white shadow-xs"
                  : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected
                    ? "bg-neutral-800 text-neutral-200"
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-900 uppercase tracking-wider font-bold">
                <th className="px-5 py-3.5">Booking ID & Guest</th>
                <th className="px-5 py-3.5">Property</th>
                <th className="px-5 py-3.5">Financials</th>
                <th className="px-5 py-3.5">Deposit Status</th>
                <th className="px-5 py-3.5">Payout Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-neutral-500 text-xs">No transactions found.</td>
                </tr>
              ) : (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className={`hover:bg-neutral-50/60 transition-colors ${t.status === "cancelled" || t.status === "declined" ? "opacity-60" : ""}`}>
                    <td className="px-5 py-4">
                      <p className="font-bold text-neutral-900 text-sm">#{t.id.slice(0, 8)}</p>
                      <p className="text-neutral-700 font-medium text-xs mt-0.5">{t.guest_name}</p>
                    </td>
                    <td className="px-5 py-4 text-neutral-700">{t.property_name}</td>
                    <td className="px-5 py-4 space-y-1">
                      <p className="text-xs font-medium text-neutral-700">Total: ₱{t.total_price}</p>
                      <p className="text-xs text-neutral-900 font-bold">Deposit: ₱{t.downpayment_amount}</p>
                      <p className="text-[10px] font-medium text-green-700">Platform (8%): ₱{t.commission_amount}</p>
                      <p className="text-[10px] font-medium text-blue-700">Host (12%): ₱{t.host_payout_amount}</p>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={t.payment_status === "verified" ? "success" : t.payment_status === "deposit_uploaded" ? "warning" : "default"} size="sm" className="capitalize">
                        {t.payment_status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={t.payout_status === "paid" ? "success" : "warning"} size="sm" className="capitalize">
                        {t.payout_status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right space-y-2">
                      <div className="flex flex-col items-end gap-2">
                        {t.payment_status === "deposit_uploaded" && t.receipt_url && (
                          <Button size="xs" onClick={() => handleViewReceipt(t)} className="bg-black text-white hover:bg-neutral-800 text-xs">
                            Verify Receipt
                          </Button>
                        )}
                        {t.payment_status === "verified" && t.payout_status === "pending" && (
                          <Button size="xs" variant="outline" onClick={() => handleMarkPaid(t.id)} className="border-blue-200 text-blue-600 hover:bg-blue-50 text-xs">
                            Mark Payout Paid
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {previewTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewTransaction(null)}>
          <div className="relative max-w-md w-full rounded-2xl overflow-hidden shadow-2xl bg-white flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 bg-neutral-50">
              <h3 className="font-bold text-neutral-900 text-sm">Verify GCash Deposit</h3>
              <button onClick={() => setPreviewTransaction(null)} className="p-1 text-neutral-500 hover:text-black"><X className="h-5 w-5" /></button>
            </div>
            <div className="relative aspect-[3/4] w-full bg-neutral-100 p-2">
              {signedReceiptUrl ? (
                <Image src={signedReceiptUrl} alt="Receipt" fill sizes="(max-width: 768px) 100vw, 400px" className="object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-neutral-500" />
                </div>
              )}
            </div>
            <div className="p-4 flex justify-end gap-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setPreviewTransaction(null)}>Cancel</Button>
              <Button size="sm" className="bg-black text-white" onClick={() => handleVerify(previewTransaction.id)}>Approve</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
