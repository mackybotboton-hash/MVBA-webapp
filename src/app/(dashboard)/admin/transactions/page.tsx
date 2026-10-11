"use client";

import * as React from "react";
import { toast } from "sonner";
import { RefreshCw, Filter, Wallet, DollarSign, ChevronDown, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { approveBookingDeposit } from "@/app/actions/admin-actions";
import { markPayoutPaidAction, markBookingRefundedAction } from "@/app/actions/admin-transactions";
import { DataTable } from "./data-table";
import { getColumns, TransactionItem, VerifyModal } from "./columns";
import { AdminPayoutModal } from "@/components/admin/admin-payout-modal";
import { calculatePayout } from "@/lib/payout-helper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtimeTransactions } from "@/hooks/use-realtime-transactions";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSearchParams } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function AdminTransactionsContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = React.useState<"all" | "verifying" | "verified" | "paid" | "cancelled">("verifying");

  React.useEffect(() => {
    if (tabParam && ["all", "verifying", "verified", "paid", "cancelled"].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [tabParam]);

  const [propertyFilter, setPropertyFilter] = React.useState<string>("all");
  const [previewTransaction, setPreviewTransaction] = React.useState<TransactionItem | null>(null);
  const [selectedPayoutTransaction, setSelectedPayoutTransaction] = React.useState<{ transaction: TransactionItem; stage: "deposit" | "balance" } | null>(null);
  const [selectedRefundTransaction, setSelectedRefundTransaction] = React.useState<TransactionItem | null>(null);
  const [isRefunding, setIsRefunding] = React.useState(false);

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
          deposit_payout_amount,
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
        deposit_payout_amount: d.deposit_payout_amount != null ? Number(d.deposit_payout_amount) : null,
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

  const handleMarkRefundedClick = React.useCallback((t: TransactionItem) => {
    setSelectedRefundTransaction(t);
  }, []);

  const handleConfirmRefund = async () => {
    if (!selectedRefundTransaction) return;
    try {
      setIsRefunding(true);
      const res = await markBookingRefundedAction(selectedRefundTransaction.id);
      if (!res.success) {
        toast.error(res.error || "Failed to mark booking as refunded.");
        return;
      }
      toast.success("Booking marked as refunded.");
      setSelectedRefundTransaction(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to mark booking as refunded.");
    } finally {
      setIsRefunding(false);
    }
  };

  const columns = React.useMemo(
    () => getColumns(handleVerifyClick, handleMarkPaidClick, handleMarkRefundedClick),
    [handleVerifyClick, handleMarkPaidClick, handleMarkRefundedClick]
  );

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
    else if (activeTab === "verified") filtered = filtered.filter(t => t.payment_status === "verified" && t.payout_status !== "deposit_paid" && t.payout_status !== "fully_paid" && t.status !== "cancelled");
    else if (activeTab === "paid") filtered = filtered.filter(t => (t.payout_status === "deposit_paid" || t.payout_status === "fully_paid") && t.status !== "cancelled");
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
      verified: transactions.filter(t => t.payment_status === "verified" && t.payout_status !== "deposit_paid" && t.payout_status !== "fully_paid" && t.status !== "cancelled").length,
      paid: transactions.filter(t => (t.payout_status === "deposit_paid" || t.payout_status === "fully_paid") && t.status !== "cancelled").length,
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
            ? (() => {
                const payouts = calculatePayout({
                  totalPrice: selectedPayoutTransaction.transaction.total_price,
                  downpaymentAmount: selectedPayoutTransaction.transaction.downpayment_amount,
                  commissionAmount: selectedPayoutTransaction.transaction.commission_amount,
                  convenienceFee: selectedPayoutTransaction.transaction.convenience_fee,
                  depositPayoutAmount: selectedPayoutTransaction.transaction.deposit_payout_amount,
                });
                return selectedPayoutTransaction.stage === "deposit"
                  ? payouts.depositPayout
                  : payouts.balancePayout;
              })()
            : undefined
        }
        onUploadComplete={handlePayoutUploadComplete}
      />

      <Dialog open={!!selectedRefundTransaction} onOpenChange={(open) => !open && setSelectedRefundTransaction(null)}>
        <DialogContent className="max-w-md p-6 bg-white rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-neutral-900">Confirm Booking Refund</DialogTitle>
            <DialogDescription className="text-xs text-neutral-600 mt-2">
              {selectedRefundTransaction && (
                (selectedRefundTransaction.payout_status === "deposit_paid" || selectedRefundTransaction.payout_status === "fully_paid") ? (
                  <div className="space-y-3">
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <strong className="block font-semibold">Warning: Host Payout Already Made!</strong>
                        The host has already been disbursed the deposit payout for this booking (Payout Status: {selectedRefundTransaction.payout_status.replace('_', ' ')}). Marking this booking as refunded confirms the deposit was returned to the guest after host payout.
                      </div>
                    </div>
                    <p className="text-xs text-neutral-600">
                      Booking #{selectedRefundTransaction.id.slice(0, 8)} ({selectedRefundTransaction.guest_name}) will be updated to <strong>refunded</strong> and excluded from platform commissions and pending payouts.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-neutral-700">
                      Are you sure you want to mark booking #{selectedRefundTransaction.id.slice(0, 8)} ({selectedRefundTransaction.guest_name}) as <strong>refunded</strong>?
                    </p>
                    <p className="text-xs text-neutral-500">
                      This confirms the deposit of ₱{selectedRefundTransaction.downpayment_amount.toLocaleString()} was refunded to the guest. It will be excluded from platform commission totals and host pending payouts.
                    </p>
                  </div>
                )
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-5">
            <Button
              variant="outline"
              size="sm"
              disabled={isRefunding}
              onClick={() => setSelectedRefundTransaction(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isRefunding}
              onClick={handleConfirmRefund}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isRefunding ? "Processing..." : "Confirm Refund"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminTransactionsPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-neutral-500">Loading transactions...</div>}>
      <AdminTransactionsContent />
    </React.Suspense>
  );
}

