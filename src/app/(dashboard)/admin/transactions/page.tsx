"use client";

import * as React from "react";
import { toast } from "sonner";
import { RefreshCw, Filter, Wallet, DollarSign, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { approveBookingDeposit } from "@/app/actions/admin-actions";
import { markPayoutPaidAction, markBookingRefundedAction } from "@/app/actions/admin-transactions";
import { DataTable } from "./data-table";
import {
  getColumns,
  TransactionItem,
  VerifyModal,
  DepositStatusBadge,
  PayoutStatusBadge,
  TransactionActions,
} from "./columns";
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
  const [expandedCardId, setExpandedCardId] = React.useState<string | null>(null);

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
          check_in_date,
          check_out_date,
          cancelled_by,
          cancelled_at,
          cancellation_reason,
          refund_total,
          deposit_refund_amount,
          fee_refund_amount,
          panaw_refund_amount,
          panaw_refund_status,
          host_refund_amount,
          host_refund_status,
          refund_gcash_number,
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
        check_in_date: d.check_in_date,
        check_out_date: d.check_out_date,
        host_gcash_number: d.rooms?.properties?.profiles?.payout_gcash_number,
        host_name: d.rooms?.properties?.profiles?.full_name,
        refund_total: d.refund_total != null ? Number(d.refund_total) : null,
        deposit_refund_amount: d.deposit_refund_amount != null ? Number(d.deposit_refund_amount) : null,
        fee_refund_amount: d.fee_refund_amount != null ? Number(d.fee_refund_amount) : null,
        panaw_refund_amount: d.panaw_refund_amount != null ? Number(d.panaw_refund_amount) : null,
        panaw_refund_status: d.panaw_refund_status,
        host_refund_amount: d.host_refund_amount != null ? Number(d.host_refund_amount) : null,
        host_refund_status: d.host_refund_status,
        refund_gcash_number: d.refund_gcash_number,
        cancellation_reason: d.cancellation_reason,
        cancelled_by: d.cancelled_by,
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

      {/* Desktop Table View (md and up) */}
      <div className="hidden md:block">
        <DataTable columns={columns} data={filteredTransactions} />
      </div>

      {/* Mobile Card View (below md) */}
      <div className="block md:hidden space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-xs text-neutral-500 shadow-2xs">
            No transactions found for the selected filter.
          </div>
        ) : (
          filteredTransactions.map((t) => {
            const isExpanded = expandedCardId === t.id;
            const payouts = calculatePayout({
              totalPrice: t.total_price,
              downpaymentAmount: t.downpayment_amount,
              commissionAmount: t.commission_amount,
              convenienceFee: t.convenience_fee,
              depositPayoutAmount: t.deposit_payout_amount,
            });

            return (
              <div
                key={t.id}
                onClick={() => setExpandedCardId(isExpanded ? null : t.id)}
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xs transition-all active:bg-neutral-50/50 cursor-pointer select-none space-y-3"
              >
                {/* Collapsed Top Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-neutral-900 truncate">
                      {t.guest_name}
                    </p>
                    <p className="text-xs text-neutral-500 font-mono">
                      #{t.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-neutral-600 truncate mt-0.5">
                      {t.property_name}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <DepositStatusBadge status={t.payment_status} />
                    {t.payout_status && (
                      <PayoutStatusBadge status={t.payout_status} />
                    )}
                  </div>
                </div>

                {/* Collapsed Primary Action Row */}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 gap-2">
                  <div className="text-[11px] font-semibold text-neutral-500 flex items-center gap-1">
                    <span>{isExpanded ? "Hide details" : "Tap for details"}</span>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 text-neutral-400" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
                    )}
                  </div>

                  <div onClick={(e) => e.stopPropagation()}>
                    <TransactionActions
                      transaction={t}
                      onVerifyClick={handleVerifyClick}
                      onMarkPaidClick={handleMarkPaidClick}
                      onMarkRefundedClick={handleMarkRefundedClick}
                      mode="primary"
                    />
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div 
                    className="pt-3 border-t border-neutral-100 space-y-3 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Stay Dates */}
                    <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100 flex justify-between items-center text-neutral-700">
                      <div>
                        <span className="text-[10px] text-neutral-500 block uppercase font-semibold">Stay Dates</span>
                        <span className="font-medium text-xs text-neutral-900">
                          {t.check_in_date && t.check_out_date ? `${t.check_in_date} → ${t.check_out_date}` : `Created ${new Date(t.created_at).toLocaleDateString()}`}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-neutral-500 block uppercase font-semibold">Status</span>
                        <span className="font-semibold text-xs capitalize text-neutral-800">
                          {t.status}
                        </span>
                      </div>
                    </div>

                    {/* Financials Breakdown */}
                    <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-100 space-y-2">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                        Financial Summary
                      </span>
                      <div className="flex justify-between text-neutral-700 font-medium">
                        <span>Total Price</span>
                        <span className="font-bold text-neutral-900">₱{t.total_price.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-neutral-600">
                        <span>Collected Deposit</span>
                        <span className="font-bold text-neutral-900">₱{t.downpayment_amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-neutral-500 text-[11px]">
                        <span>Convenience Fee (Platform)</span>
                        <span>₱{(t.convenience_fee || 100).toLocaleString()}</span>
                      </div>
                      <div className="border-t border-neutral-200/60 my-1"></div>
                      <div className="flex justify-between text-green-700 font-medium">
                        <span>Platform Commission</span>
                        <span>₱{(t.commission_amount || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-blue-700 font-medium">
                        <span>Host Deposit Share</span>
                        <span>₱{payouts.depositPayout.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-amber-700 font-semibold">
                        <span>Guest Pays at Check-in</span>
                        <span>₱{payouts.balancePayout.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Secondary Actions */}
                    <div className="flex justify-end pt-1">
                      <TransactionActions
                        transaction={t}
                        onVerifyClick={handleVerifyClick}
                        onMarkPaidClick={handleMarkPaidClick}
                        onMarkRefundedClick={handleMarkRefundedClick}
                        mode="secondary"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

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
                <div className="space-y-3 pt-1">
                  {(selectedRefundTransaction.payout_status === "deposit_paid" || selectedRefundTransaction.payout_status === "fully_paid") && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <strong className="block font-semibold">Warning: Host Payout Already Disbursed!</strong>
                        The host was already disbursed deposit payout for this booking ({selectedRefundTransaction.payout_status.replace('_', ' ')}). Host refund leg of ₱{(selectedRefundTransaction.host_refund_amount || 0).toLocaleString()} must be collected from the host.
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-neutral-800">Booking #{selectedRefundTransaction.id.slice(0, 8)}</span>
                      <span className="text-[11px] text-neutral-500">Guest: {selectedRefundTransaction.guest_name}</span>
                    </div>

                    <div className="border-t border-neutral-200/80 pt-2 space-y-1">
                      <div className="flex justify-between text-neutral-600">
                        <span>Total Refund Due:</span>
                        <span className="font-bold text-neutral-900">
                          ₱{(selectedRefundTransaction.refund_total ?? selectedRefundTransaction.downpayment_amount).toLocaleString()}
                        </span>
                      </div>
                      {selectedRefundTransaction.panaw_refund_amount != null && (
                        <div className="flex justify-between text-[11px] text-neutral-600">
                          <span>Panaw Platform Leg:</span>
                          <span className="font-medium text-neutral-800">₱{selectedRefundTransaction.panaw_refund_amount.toLocaleString()}</span>
                        </div>
                      )}
                      {selectedRefundTransaction.host_refund_amount != null && selectedRefundTransaction.host_refund_amount > 0 && (
                        <div className="flex justify-between text-[11px] text-neutral-600">
                          <span>Host Leg:</span>
                          <span className="font-medium text-neutral-800">₱{selectedRefundTransaction.host_refund_amount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-[11px] text-neutral-600 pt-1 border-t border-neutral-200/60">
                        <span>GCash Destination:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {selectedRefundTransaction.refund_gcash_number || "Not provided (contact guest)"}
                        </span>
                      </div>
                      {selectedRefundTransaction.cancellation_reason && (
                        <p className="text-[11px] text-neutral-600 italic pt-1">
                          Reason: &ldquo;{selectedRefundTransaction.cancellation_reason}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-neutral-500">
                    Confirming this will update payment status to <strong>refunded</strong> and mark Panaw refund status as sent.
                  </p>
                </div>
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

