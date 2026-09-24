"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Ticket,
  RefreshCw,
  Plus,
  WifiOff,
  Wifi,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/shared/logo";
import {
  BookingCard,
  type BookingData,
} from "@/components/tourist/booking-card";
import { EmptyState } from "@/components/tourist/empty-state";
import { LoadingLogo } from "@/components/shared/loading-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DigitalBoardingPassModal } from "@/components/tourist/digital-boarding-pass-modal";
import { GCashDepositModal } from "@/components/tourist/gcash-deposit-modal";
import { TouristReviewModal } from "@/components/tourist/tourist-review-modal";
import { TouristViewPaymentModal } from "@/components/tourist/tourist-view-payment-modal";
import { submitDepositReceiptAction } from "@/app/actions/booking-actions";
import { useOfflineBoardingPasses } from "@/hooks/use-offline-boarding-passes";
import { BoardingPassData } from "@/lib/boarding-pass-generator";

type BookingFilterTab =
  | "all"
  | "pending"
  | "awaiting_deposit"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "offline";

export default function TouristBookingsPage() {
  const [bookings, setBookings] = React.useState<BookingData[]>([]);
  const [userName, setUserName] = React.useState<string>("Tourist Guest");
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<BookingFilterTab>("all");
  const [selectedPassBooking, setSelectedPassBooking] =
    React.useState<BoardingPassData | null>(null);
  const [selectedDepositBooking, setSelectedDepositBooking] =
    React.useState<BookingData | null>(null);
  const [selectedPaymentBooking, setSelectedPaymentBooking] =
    React.useState<BookingData | null>(null);
  const [selectedReviewBooking, setSelectedReviewBooking] =
    React.useState<BookingData | null>(null);

  const {
    cachedPasses,
    isOnline,
    saveMultiplePasses,
    hasPass,
  } = useOfflineBoardingPasses();

  const fetchBookings = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setBookings([]);
        setIsLoading(false);
        return;
      }

      if (user.user_metadata?.full_name) {
        setUserName(user.user_metadata.full_name);
      } else if (user.email) {
        setUserName(user.email.split("@")[0]);
      }

      // Fetch bookings joined with room and property
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
          check_in_date,
          check_out_date,
          guest_count,
          total_price,
          status,
          payment_status,
          downpayment_amount,
          receipt_url,
          created_at,
          rooms (
            id,
            name,
            properties (
              id,
              name,
              type,
              owner_id
            )
          )
        `)
        .eq("tourist_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        if (!navigator.onLine) {
          toast.info("Offline mode active. Displaying saved passes.");
        } else {
          toast.error("Failed to load bookings.");
        }
      } else {
        const mapped: BookingData[] = (data || []).map((b: any) => ({
          id: b.id,
          property_id: b.rooms?.properties?.id,
          property_name: b.rooms?.properties?.name || "Bretania Island Stay",
          property_type: b.rooms?.properties?.type,
          room_name: b.rooms?.name || "Standard Accommodation",
          check_in_date: b.check_in_date,
          check_out_date: b.check_out_date,
          guest_count: b.guest_count,
          total_price: Number(b.total_price),
          downpayment_amount: Number(b.downpayment_amount),
          payment_status: b.payment_status,
          receipt_url: b.receipt_url,
          status: b.status,
          owner_id: b.rooms?.properties?.owner_id,
        }));
        setBookings(mapped);

        // Auto-cache confirmed & completed reservations for offline island boarding
        const passesToCache: BoardingPassData[] = mapped
          .filter((b) => b.status === "completed" || b.payment_status === "verified" || b.status === "accepted")
          .map((b) => ({
            id: b.id,
            property_name: b.property_name,
            room_name: b.room_name,
            guest_name: user.user_metadata?.full_name || "Tourist Guest",
            check_in: b.check_in_date,
            check_out: b.check_out_date,
            guests_count: b.guest_count,
            total_price: b.total_price,
            status: b.status,
            reference_code: `MVBA-BRIT-${b.id.slice(0, 4).toUpperCase()}`,
          }));

        if (passesToCache.length > 0) {
          saveMultiplePasses(passesToCache);
        }
      }
    } catch {
      if (!navigator.onLine) {
        toast.info("Offline mode active. Saved passes are available.");
      } else {
        toast.error("An error occurred while loading your bookings.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [saveMultiplePasses]);

  React.useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleCancelBooking = async (bookingId: string) => {
    try {
      const supabase = createClient();
      await (supabase.from("bookings") as any)
        .update({ status: "cancelled" })
        .eq("id", bookingId);

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: "cancelled" } : b))
      );
      toast.success("Booking request cancelled", {
        description: "The property owner has been notified.",
      });
    } catch {
      toast.error("Failed to cancel booking. Please try again.");
    }
  };

  const filteredBookings = React.useMemo(() => {
    if (activeTab === "all") return bookings;
    if (activeTab === "offline") {
      // Return bookings that are in the offline cache
      return bookings.filter((b) => hasPass(b.id));
    }
    if (activeTab === "awaiting_deposit") {
      return bookings.filter((b) => b.status === "accepted" && b.payment_status !== "verified");
    }
    if (activeTab === "confirmed") {
      return bookings.filter((b) => b.status === "accepted" && b.payment_status === "verified");
    }
    return bookings.filter((b) => b.status === activeTab);
  }, [bookings, activeTab, hasPass]);

  const counts = React.useMemo(() => {
    return {
      all: bookings.length,
      pending: bookings.filter((b) => b.status === "pending").length,
      awaiting_deposit: bookings.filter((b) => b.status === "accepted" && b.payment_status !== "verified").length,
      confirmed: bookings.filter((b) => b.status === "accepted" && b.payment_status === "verified").length,
      completed: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
      offline: cachedPasses.length,
    };
  }, [bookings, cachedPasses]);

  return (
    <div className="min-h-screen bg-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo size="small" />
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              My Reservations
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Offline indicator badge in header */}
            {!isOnline && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                <WifiOff className="h-3 w-3" />
                Offline
              </span>
            )}

            <Link href="/">
              <Button
                size="sm"
                className="bg-black text-white hover:bg-neutral-800 text-xs h-8 px-3"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Book New Stay
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
        {/* Offline Banner Callout when disconnected */}
        {!isOnline && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                <WifiOff className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">You are currently offline</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  No cellular signal needed. Your {cachedPasses.length} saved boarding pass{cachedPasses.length === 1 ? "" : "es"} are securely stored on your device and ready to present at the dock.
                </p>
              </div>
            </div>

            {cachedPasses.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveTab("offline")}
                className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100 text-xs h-8 font-semibold shrink-0"
              >
                View Offline Passes ({cachedPasses.length})
              </Button>
            )}
          </div>
        )}

        {/* Page Title & Context */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
                My Bookings
              </h1>
              {cachedPasses.length > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                  <ShieldCheck className="h-3 w-3" />
                  {cachedPasses.length} Pass{cachedPasses.length === 1 ? "" : "es"} Cached Offline
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-neutral-600 mt-1">
              Manage your upcoming island stays and access instant digital boarding passes
            </p>
          </div>

          <button
            onClick={fetchBookings}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-black font-medium self-start sm:self-auto transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Status Segment Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide border-b border-neutral-200 pb-2">
          {[
            { id: "all", label: "All Bookings", count: counts.all },
            { id: "pending", label: "Pending", count: counts.pending },
            { id: "awaiting_deposit", label: "Awaiting Deposit", count: counts.awaiting_deposit },
            { id: "confirmed", label: "Confirmed", count: counts.confirmed },
            { id: "completed", label: "Completed", count: counts.completed },
            { id: "cancelled", label: "Cancelled", count: counts.cancelled },
            ...(cachedPasses.length > 0
              ? [{ id: "offline", label: "Offline Passes", icon: WifiOff, count: counts.offline }]
              : []),
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as BookingFilterTab)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 select-none ${
                  isSelected
                    ? "bg-black text-white shadow-xs"
                    : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
                }`}
              >
                {(() => {
                  const Icon = (tab as any).icon;
                  return Icon ? <Icon className="h-3.5 w-3.5 mr-0.5" /> : null;
                })()}
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

        {/* Content: Loading Skeleton, Empty State, or Booking Cards List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <LoadingLogo size="large" />
            <p className="mt-6 text-sm font-semibold tracking-wider uppercase text-neutral-400 animate-pulse">
              Loading your reservations
            </p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title={
              activeTab === "all"
                ? "No reservations found"
                : activeTab === "offline"
                ? "No offline boarding passes cached"
                : `No ${activeTab} reservations`
            }
            description={
              activeTab === "all"
                ? "You haven't requested any bookings yet. Explore accredited homestays and resorts in Bretania to plan your next island trip."
                : activeTab === "offline"
                ? "Boarding passes are automatically saved to your device when your reservation is confirmed."
                : `You currently do not have any bookings marked as ${activeTab}.`
            }
            actionLabel="Discover Stays in Bretania"
            onAction={() => (window.location.href = "/")}
            secondaryActionLabel="Refresh"
            onSecondaryAction={fetchBookings}
          />
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <div key={booking.id} className="relative">
                {/* Visual indicator tag on card if pass is cached offline */}
                {hasPass(booking.id) && (
                  <div className="absolute top-3 right-3 z-10 hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                    <ShieldCheck className="h-3 w-3" />
                    Offline Ready
                  </div>
                )}
                <BookingCard
                  booking={booking}
                  onCancelBooking={handleCancelBooking}
                  onViewBoardingPass={(b) =>
                    setSelectedPassBooking({
                      id: b.id,
                      property_name: b.property_name,
                      room_name: b.room_name,
                      guest_name: userName,
                      check_in: b.check_in_date,
                      check_out: b.check_out_date,
                      guests_count: b.guest_count,
                      total_price: b.total_price,
                      status: b.status,
                      reference_code: `MVBA-BRIT-${b.id.slice(0, 4).toUpperCase()}`,
                    })
                  }
                  onViewPayment={(b) => setSelectedPaymentBooking(b)}
                  onPayDeposit={(b) => setSelectedDepositBooking(b)}
                  onRateStay={(b) => setSelectedReviewBooking(b)}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Digital Boarding Pass QR Modal */}
      <DigitalBoardingPassModal
        isOpen={!!selectedPassBooking}
        onClose={() => setSelectedPassBooking(null)}
        booking={selectedPassBooking}
      />

      {/* GCash Deposit Modal */}
      <GCashDepositModal
        isOpen={!!selectedDepositBooking}
        onClose={() => setSelectedDepositBooking(null)}
        bookingId={selectedDepositBooking?.id || ""}
        amount={selectedDepositBooking?.downpayment_amount}
        onUploadComplete={async (payload) => {
          if (!selectedDepositBooking) return;
          const supabase = createClient();

          try {
            const fileExt = payload.receiptFile.name.split(".").pop();
            const filePath = `${selectedDepositBooking.id}-${Date.now()}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("payment-receipts")
              .upload(filePath, payload.receiptFile);

            if (uploadError) throw uploadError;

            const result = await submitDepositReceiptAction({
              bookingId: selectedDepositBooking.id,
              receiptPath: uploadData.path,
              referenceNumber: payload.referenceNumber,
            });

            if (!result.success) {
              throw new Error(result.error || "Failed to record payment");
            }

            toast.success("Payment submitted successfully!");
            await fetchBookings();
          } catch (error) {
            console.error("Failed to upload deposit:", error);
            throw error;
          }
        }}
      />

      {/* Rate Stay Modal */}
      <TouristReviewModal
        isOpen={!!selectedReviewBooking}
        onClose={() => setSelectedReviewBooking(null)}
        booking={selectedReviewBooking}
      />

      {/* View Payment Modal */}
      <TouristViewPaymentModal
        isOpen={!!selectedPaymentBooking}
        onClose={() => setSelectedPaymentBooking(null)}
        booking={selectedPaymentBooking}
      />
    </div>
  );
}
