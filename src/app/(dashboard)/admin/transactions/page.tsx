"use client";

import * as React from "react";
import { toast } from "sonner";
import { RefreshCw, Filter, Wallet, DollarSign, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { approveBookingDeposit } from "@/app/actions/admin-actions";
import { markPayoutPaidAction } from "@/app/actions/admin-transactions";
import { DataTable } from "./data-table";
import { getColumns, TransactionItem, VerifyModal } from "./columns";
import { AdminPayoutModal } from "@/components/admin/admin-payout-modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtimeTransactions } from "@/hooks/use-realtime-transactions";
import { MetricCard } from "@/components/ui/metric-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AdminTransactionsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<"all" | "verifying" | "verified" | "paid" | "cancelled">("verifying");
  const [propertyFilter, setPropertyFilter] = React.useState<string>("all");
  const [previewTransaction, setPreviewTransaction] = React.useState<TransactionItem | null>(null);
  const [selectedPayoutTransaction, setSelectedPayoutTransaction] = React.useState<{ transaction: TransactionItem; stage: "deposit" | "balance" } | null>(null);

  // Supabase Realtime — auto-refresh when deposits are uploaded or statuses change
  useRealtimeTransactions();

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
          convenience_fee,
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
        convenience_fee: Number(d.convenience_fee),
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

  const handlePayoutUploadComplete = async (payload: { receiptFile: File }) => {
    if (!selectedPayoutTransaction) return;
    
    try {
      const fileExt = payload.receiptFile.name.split('.').pop();
      const filePath = `payouts/${selectedPayoutTransaction.transaction.id}-${selectedPayoutTransaction.stage}-${Date.now()}.${fileExt}`;

      const supabase = createClient();
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("payment-receipts")
        .upload(filePath, payload.receiptFile);

      if (uploadError) throw uploadError;

      const res = await markPayoutPaidAction(selectedPayoutTransaction.transaction.id, uploadData.path, selectedPayoutTransaction.stage);
      
      if (!res.success) {
        throw new Error(res.error || "Failed to update database");
      }

      toast.success("Payout marked as paid with receipt!");
      queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
    } catch (error: any) {
      console.error("Payout upload error:", error);
      throw error;
    }
  };

  const handleVerifyClick = React.useCallback((t: TransactionItem) => {
    setPreviewTransaction(t);
  }, []);

  const handleMarkPaidClick = React.useCallback((t: TransactionItem, stage: "deposit" | "balance") => {
    setSelectedPayoutTransaction({ transaction: t, stage });
  }, []);

  const columns = React.useMemo(() => getColumns(handleVerifyClick, handleMarkPaidClick), [handleVerifyClick, handleMarkPaidClick]);

  const properties = React.useMemo(() => {
    const props = new Set<string>();
    transactions.forEach(t => {
      if (t.property_name && t.property_name !== "Property") {
        props.add(t.property_name);
      }
    });
    return Array.from(props).sort();
  }, [transactions]);

  const filteredTransactions = React.useMemo(() => {
    let filtered = transactions;
    if (activeTab === "all") filtered = filtered.filter(t => t.status !== "cancelled" && t.status !== "declined");
    else if (activeTab === "verifying") filtered = filtered.filter(t => t.payment_status === "deposit_uploaded" && t.status !== "cancelled");
    else if (activeTab === "verified") filtered = filtered.filter(t => t.payment_status === "verified" && t.payout_status !== "fully_paid" && t.status !== "cancelled");
    else if (activeTab === "paid") filtered = filtered.filter(t => t.payout_status === "fully_paid" && t.status !== "cancelled");
    else if (activeTab === "cancelled") filtered = filtered.filter(t => t.status === "cancelled" || t.status === "declined");

    if (propertyFilter !== "all") {
      filtered = filtered.filter(t => t.property_name === propertyFilter);
    }
    return filtered;
  }, [transactions, activeTab, propertyFilter]);

  const counts = React.useMemo(() => {
    return {
      all: transactions.filter(t => t.status !== "cancelled" && t.status !== "declined").length,
      verifying: transactions.filter(t => t.payment_status === "deposit_uploaded" && t.status !== "cancelled").length,
      verified: transactions.filter(t => t.payment_status === "verified" && t.payout_status !== "fully_paid" && t.status !== "cancelled").length,
      paid: transactions.filter(t => t.payout_status === "fully_paid" && t.status !== "cancelled").length,
      cancelled: transactions.filter(t => t.status === "cancelled" || t.status === "declined").length,
    };
  }, [transactions]);

  const metrics = React.useMemo(() => {
    const verifiedTxs = transactions.filter(t => t.payment_status === "verified" && t.status !== "cancelled" && t.status !== "declined");
    const totalDeposits = verifiedTxs.reduce((sum, t) => sum + (t.downpayment_amount || 0), 0);
    const totalCommissions = verifiedTxs.reduce((sum, t) => sum + (t.commission_amount || 0), 0);
    return { totalDeposits, totalCommissions };
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

      {/* Metrics Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard
          label="Total Deposits Collected"
          value={`₱${metrics.totalDeposits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtext="From verified transactions"
          icon={Wallet}
          variant="emerald"
        />
        <MetricCard
          label="Platform Commissions"
          value={`₱${metrics.totalCommissions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtext="Earnings from verified transactions"
          icon={DollarSign}
          variant="dark"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 border-b border-neutral-200 pb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-700">Filter by:</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center justify-between min-w-[180px] px-3.5 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-black">
              <span className="flex items-center gap-2">
                {activeTab === "verifying" && (
                  <>
                    To Verify
                    {counts.verifying > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{counts.verifying}</span>
                    )}
                  </>
                )}
                {activeTab === "verified" && "Ready for Payout"}
                {activeTab === "paid" && "Paid Out"}
                {activeTab === "all" && "Active Transactions"}
                {activeTab === "cancelled" && "Cancelled"}
              </span>
              <ChevronDown className="h-4 w-4 text-neutral-500 ml-2" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[180px] p-1.5 bg-white border border-neutral-200 rounded-xl shadow-lg">
              {[
                { id: "verifying", label: "To Verify", count: counts.verifying },
                { id: "verified", label: "Ready for Payout", count: counts.verified },
                { id: "paid", label: "Paid Out", count: counts.paid },
                { id: "all", label: "Active Transactions", count: counts.all },
                { id: "cancelled", label: "Cancelled", count: counts.cancelled },
              ].map((tab) => (
                <DropdownMenuItem 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors ${
                    activeTab === tab.id ? "bg-neutral-100 font-bold text-neutral-900" : "hover:bg-neutral-50 text-neutral-700"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab.id === 'verifying' && tab.count > 0 ? 'bg-red-500 text-white' : 'text-neutral-500 bg-neutral-100'}`}>{tab.count}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center justify-between min-w-[180px] px-3.5 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-black">
              <span className="truncate max-w-[140px]">
                {propertyFilter === "all" ? "All Properties" : propertyFilter}
              </span>
              <ChevronDown className="h-4 w-4 text-neutral-500 ml-2 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[220px] max-h-[300px] overflow-y-auto p-1.5 bg-white border border-neutral-200 rounded-xl shadow-lg">
              <DropdownMenuItem 
                onClick={() => setPropertyFilter("all")}
                className={`px-3 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors ${
                  propertyFilter === "all" ? "bg-neutral-100 font-bold text-neutral-900" : "hover:bg-neutral-50 text-neutral-700"
                }`}
              >
                All Properties
              </DropdownMenuItem>
              {properties.map((prop) => (
                <DropdownMenuItem 
                  key={prop}
                  onClick={() => setPropertyFilter(prop)}
                  className={`px-3 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors ${
                    propertyFilter === prop ? "bg-neutral-100 font-bold text-neutral-900" : "hover:bg-neutral-50 text-neutral-700"
                  }`}
                >
                  <span className="truncate">{prop}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <DataTable columns={columns} data={filteredTransactions} />

      <VerifyModal 
        transaction={previewTransaction} 
        onClose={() => setPreviewTransaction(null)} 
        onVerify={async (id) => { await verifyMutation.mutateAsync(id); }}
        isVerifying={verifyMutation.isPending}
      />

      <AdminPayoutModal
        isOpen={!!selectedPayoutTransaction}
        onClose={() => setSelectedPayoutTransaction(null)}
        bookingId={selectedPayoutTransaction?.transaction.id || ""}
        hostName={selectedPayoutTransaction?.transaction.host_name || ""}
        hostGcashNumber={selectedPayoutTransaction?.transaction.host_gcash_number || ""}
        payoutStage={selectedPayoutTransaction?.stage}
        payoutAmount={
          selectedPayoutTransaction 
            ? (selectedPayoutTransaction.stage === "deposit"
                ? (selectedPayoutTransaction.transaction.downpayment_amount - selectedPayoutTransaction.transaction.convenience_fee) - (selectedPayoutTransaction.transaction.commission_amount * 0.20)
                : selectedPayoutTransaction.transaction.host_payout_amount - ((selectedPayoutTransaction.transaction.downpayment_amount - selectedPayoutTransaction.transaction.convenience_fee) - (selectedPayoutTransaction.transaction.commission_amount * 0.20)))
            : undefined
        }
        onUploadComplete={handlePayoutUploadComplete}
      />
    </div>
  );
}
