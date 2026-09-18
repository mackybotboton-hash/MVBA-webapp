"use client";

import * as React from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { approveBookingDeposit } from "@/app/actions/admin-actions";
import { markPayoutPaidAction } from "@/app/actions/admin-transactions";
import { DataTable } from "./data-table";
import { getColumns, TransactionItem, VerifyModal } from "./columns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function AdminTransactionsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<"all" | "verifying" | "verified" | "paid" | "cancelled">("all");
  const [previewTransaction, setPreviewTransaction] = React.useState<TransactionItem | null>(null);

  // Fetch Transactions using React Query
  const { data: transactions = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-transactions'],
    queryFn: async () => {
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
            properties (
              name,
              owner_id,
              profiles!owner_id (
                payout_gcash_number,
                full_name
              )
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      return data?.map((d: any) => ({
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
        host_gcash_number: d.rooms?.properties?.profiles?.payout_gcash_number,
        host_name: d.rooms?.properties?.profiles?.full_name,
      })) as TransactionItem[];
    }
  });

  // Verify Deposit Mutation
  const verifyMutation = useMutation({
    mutationFn: (id: string) => approveBookingDeposit(id),
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['admin-transactions'] });

      // Snapshot the previous value
      const previousTransactions = queryClient.getQueryData<TransactionItem[]>(['admin-transactions']);

      // Optimistically update to the new value
      if (previousTransactions) {
        queryClient.setQueryData<TransactionItem[]>(['admin-transactions'], old => {
          if (!old) return [];
          return old.map(t => 
            t.id === id 
              ? { ...t, payment_status: "verified", payout_status: "pending" }
              : t
          );
        });
      }

      setPreviewTransaction(null);
      return { previousTransactions };
    },
    onError: (err, id, context) => {
      // Rollback to the previous value if mutation fails
      if (context?.previousTransactions) {
        queryClient.setQueryData(['admin-transactions'], context.previousTransactions);
      }
      toast.error("An error occurred: " + err.message);
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Deposit verified!");
      } else {
        toast.error("Failed to verify deposit: " + res.error);
        queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
    }
  });

  // Mark Paid Mutation
  const markPaidMutation = useMutation({
    mutationFn: (id: string) => markPayoutPaidAction(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Payout marked as paid!");
        queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
      } else {
        toast.error("Failed to update payout status: " + res.error);
      }
    },
    onError: (err: any) => {
      toast.error("An error occurred: " + err.message);
    }
  });

  const handleVerifyClick = React.useCallback((t: TransactionItem) => {
    setPreviewTransaction(t);
  }, []);

  const handleMarkPaidClick = React.useCallback((id: string) => {
    markPaidMutation.mutate(id);
  }, [markPaidMutation]);

  const columns = React.useMemo(() => getColumns(handleVerifyClick, handleMarkPaidClick), [handleVerifyClick, handleMarkPaidClick]);

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
        <button onClick={() => refetch()} className="p-2 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-600 transition-colors">
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

      <DataTable columns={columns} data={filteredTransactions} />

      <VerifyModal 
        transaction={previewTransaction} 
        onClose={() => setPreviewTransaction(null)} 
        onVerify={async (id) => verifyMutation.mutateAsync(id)}
        isVerifying={verifyMutation.isPending}
      />
    </div>
  );
}
