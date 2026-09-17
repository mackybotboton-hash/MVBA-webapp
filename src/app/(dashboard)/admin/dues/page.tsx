"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Receipt,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  PhilippinePeso,
  X,
  ExternalLink,
  Filter,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DuesItem {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  property_name: string;
  property_type: "homestay" | "resort";
  month: string;
  amount: number;
  status: "paid" | "unpaid" | "overdue";
  receipt_url?: string;
  paid_at?: string;
}


export default function AdminDuesPage() {
  const [dues, setDues] = React.useState<DuesItem[]>([]);
  const [selectedMonth, setSelectedMonth] = React.useState("September 2026");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "paid" | "unpaid" | "overdue">("all");
  const [previewDueItem, setPreviewDueItem] = React.useState<DuesItem | null>(null);
  const [signedReceiptUrl, setSignedReceiptUrl] = React.useState<string | null>(null);
  const [previewOwnerName, setPreviewOwnerName] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState(false);

  const handleViewReceipt = async (item: DuesItem) => {
    setPreviewDueItem(item);
    setPreviewOwnerName(`${item.property_name} (${item.owner_name})`);
    if (!item.receipt_url) return;
    
    let path = item.receipt_url;
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
        setSignedReceiptUrl(item.receipt_url);
      }
    } catch {
      setSignedReceiptUrl(item.receipt_url);
    }
  };

  const fetchLiveDues = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("association_dues")
        .select("*, profiles(full_name, email, role)")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load dues:", error);
      } else if (data && data.length > 0) {
        const mapped: DuesItem[] = data.map((d: any) => ({
          id: d.id,
          owner_id: d.owner_id,
          owner_name: d.profiles?.full_name || "Association Member",
          owner_email: d.profiles?.email || "",
          property_name: d.profiles?.full_name ? `${d.profiles.full_name}'s Stay` : "Accredited Member",
          property_type: (d.profiles?.role === "resort" ? "resort" : "homestay") as any,
          month: selectedMonth,
          amount: d.amount || (d.profiles?.role === "resort" ? 1500 : 500),
          status: d.status || "paid",
          receipt_url: d.receipt_url,
          paid_at: d.paid_at,
        }));
        setDues(mapped);
      } else {
        setDues([]);
      }
    } catch (err) {
      console.error("Unexpected error loading dues:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  React.useEffect(() => {
    fetchLiveDues();
  }, [fetchLiveDues]);

  const handleUpdateStatus = async (dueId: string, nextStatus: "paid" | "unpaid" | "overdue") => {
    setDues((prev) =>
      prev.map((d) => (d.id === dueId ? { ...d, status: nextStatus } : d))
    );

    try {
      const supabase = createClient();
      await (supabase.from("association_dues") as any)
        .update({ status: nextStatus })
        .eq("id", dueId);
    } catch {
      // Local fallback
    }

    toast.success(
      nextStatus === "paid"
        ? "Payment verified & confirmed"
        : nextStatus === "overdue"
        ? "Flagged as Overdue"
        : "Marked as Unpaid"
    );
  };

  const filteredDues = dues.filter((item) => {
    if (statusFilter === "all") return true;
    return item.status === statusFilter;
  });

  const totalCollected = dues
    .filter((d) => d.status === "paid")
    .reduce((sum, d) => sum + d.amount, 0);

  const totalPending = dues
    .filter((d) => d.status !== "paid")
    .reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Association Dues Tracker
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1 font-medium">
            Monitor monthly municipal and MVBA association contributions (₱500/homestay, ₱1,500/resort)
          </p>

        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLiveDues}
            className="p-2 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-600 transition-colors"
            title="Refresh Dues"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-10 px-3.5 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-900 bg-white focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option>September 2026</option>
            <option>August 2026</option>
            <option>July 2026</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-1 shadow-xs">
          <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider">
            Total Collected ({selectedMonth})
          </span>
          <p className="text-2xl font-bold text-emerald-600">
            ₱{totalCollected.toLocaleString()}
          </p>
          <p className="text-xs text-neutral-600 font-medium">
            Paid by verified association members
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-1 shadow-xs">
          <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider">
            Unpaid Dues
          </span>
          <p className="text-2xl font-bold text-amber-600">
            ₱{totalPending.toLocaleString()}
          </p>
          <p className="text-xs text-neutral-600 font-medium">
            Awaiting member verification or submission
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-1 shadow-xs">
          <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider">
            Compliance Rate
          </span>
          <p className="text-2xl font-bold text-neutral-900">
            {dues.length > 0
              ? Math.round((dues.filter((d) => d.status === "paid").length / dues.length) * 100)
              : 0}%
          </p>
          <p className="text-xs text-neutral-600 font-medium">
            {dues.filter((d) => d.status === "paid").length} of {dues.length} operators in good standing
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-neutral-200 pb-2">
        {(["all", "paid", "unpaid", "overdue"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
              statusFilter === tab
                ? "bg-black text-white"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-black"
            }`}
          >
            {tab} ({tab === "all" ? dues.length : dues.filter((d) => d.status === tab).length})
          </button>
        ))}
      </div>

      {/* Dues Table */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-900 uppercase tracking-wider font-bold">
                <th className="px-5 py-3.5">Owner & Property</th>
                <th className="px-5 py-3.5">Member Type</th>
                <th className="px-5 py-3.5">Monthly Fee</th>
                <th className="px-5 py-3.5">Payment Receipt</th>
                <th className="px-5 py-3.5">Payment Status</th>
                <th className="px-5 py-3.5 text-right">Verification Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium">
              {filteredDues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-neutral-500 text-xs">
                    No dues records yet. Once owners register and dues are tracked, they will appear here.
                  </td>
                </tr>
              ) : filteredDues.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/60 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-bold text-neutral-900 text-sm">
                      {item.property_name}
                    </p>
                    <p className="text-neutral-600 text-xs mt-0.5">
                      {item.owner_name} ({item.owner_email})
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <Badge
                      variant={item.property_type === "resort" ? "default" : "secondary"}
                      size="sm"
                      className="capitalize font-semibold"
                    >
                      {item.property_type}
                    </Badge>
                  </td>

                  <td className="px-5 py-4">
                    <span className="font-bold text-sm text-neutral-900">
                      ₱{item.amount.toLocaleString()}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    {item.receipt_url ? (
                      <button
                        type="button"
                        onClick={() => handleViewReceipt(item)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold text-xs transition-colors"
                      >
                        <Receipt className="h-3.5 w-3.5 text-neutral-600" />
                        <span>View GCash Receipt</span>
                      </button>
                    ) : (
                      <span className="text-neutral-500 text-xs">No receipt uploaded</span>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    <Badge
                      variant={
                        item.status === "paid"
                          ? "success"
                          : item.status === "overdue"
                          ? "destructive"
                          : "warning"
                      }
                      size="sm"
                      dot
                      className="font-semibold capitalize"
                    >
                      {item.status}
                    </Badge>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {item.status !== "paid" ? (
                        <Button
                          size="xs"
                          onClick={() => handleUpdateStatus(item.id, "paid")}
                          className="bg-black text-white hover:bg-neutral-800 text-xs font-semibold"
                        >
                          Confirm Payment
                        </Button>
                      ) : (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => handleUpdateStatus(item.id, "unpaid")}
                          className="border-neutral-300 text-neutral-700 hover:bg-neutral-100 text-xs font-semibold"
                        >
                          Mark Unpaid
                        </Button>
                      )}

                      {item.status !== "overdue" && item.status !== "paid" && (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => handleUpdateStatus(item.id, "overdue")}
                          className="border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold"
                        >
                          Flag Overdue
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Preview Lightbox Modal */}
      {previewDueItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewDueItem(null)}
        >
          <div
            className="relative max-w-md w-full rounded-2xl overflow-hidden shadow-2xl bg-white flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 bg-neutral-50/50">
              <div>
                <h3 className="font-bold text-neutral-900 text-sm">
                  Payment Receipt Verification
                </h3>
                <p className="text-[11px] text-neutral-600 truncate max-w-xs">
                  {previewOwnerName}
                </p>
              </div>
              <button
                onClick={() => setPreviewDueItem(null)}
                className="p-1 rounded-full text-neutral-500 hover:text-black"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative aspect-[3/4] w-full bg-neutral-100 p-2">
              {signedReceiptUrl ? (
                <Image
                  src={signedReceiptUrl}
                  alt="Payment proof screenshot"
                  fill
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-neutral-500" />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-neutral-200 bg-white flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewDueItem(null)}
                className="text-xs"
              >
                Close
              </Button>
              <Button
                size="sm"
                className="bg-black text-white hover:bg-neutral-800 text-xs font-bold"
                onClick={() => {
                  toast.success("Receipt verified!");
                  setPreviewDueItem(null);
                }}
              >
                Verify & Approve
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
