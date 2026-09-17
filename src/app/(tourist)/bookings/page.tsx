"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Ticket,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Compass,
  RefreshCw,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/shared/logo";
import {
  BookingCard,
  type BookingData,
} from "@/components/tourist/booking-card";
import { EmptyState } from "@/components/tourist/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DigitalBoardingPassModal } from "@/components/tourist/digital-boarding-pass-modal";
import { GCashDepositModal } from "@/components/tourist/gcash-deposit-modal";
import { TouristReviewModal } from "@/components/tourist/tourist-review-modal";


type BookingFilterTab = "all" | "pending" | "accepted" | "completed" | "cancelled";

export default function TouristBookingsPage() {
  const [bookings, setBookings] = React.useState<BookingData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<BookingFilterTab>("all");
  const [selectedPassBooking, setSelectedPassBooking] = React.useState<any | null>(null);
  const [selectedDepositBooking, setSelectedDepositBooking] = React.useState<BookingData | null>(null);
  const [selectedReviewBooking, setSelectedReviewBooking] = React.useState<BookingData | null>(null);

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
        toast.error("Failed to load bookings.");
        setBookings([]);
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
          status: b.status,
          owner_id: b.rooms?.properties?.owner_id,
        }));
        setBookings(mapped);
      }
    } catch {
      toast.error("An error occurred while loading your bookings.");
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    return bookings.filter((b) => b.status === activeTab);
  }, [bookings, activeTab]);

  const counts = React.useMemo(() => {
    return {
      all: bookings.length,
      pending: bookings.filter((b) => b.status === "pending").length,
      accepted: bookings.filter((b) => b.status === "accepted").length,
      completed: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
    };
  }, [bookings]);

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
        {/* Page Title & Context */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
              My Bookings
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 mt-1">
              Manage your upcoming island stays and view confirmed reservations
            </p>
          </div>

          <button
            onClick={fetchBookings}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-black font-medium self-start sm:self-auto"
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
            { id: "accepted", label: "Confirmed", count: counts.accepted },
            { id: "completed", label: "Completed", count: counts.completed },
            { id: "cancelled", label: "Cancelled", count: counts.cancelled },
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
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4"
              >
                <div className="flex justify-between items-center">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <div className="grid grid-cols-3 gap-4 py-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredBookings.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title={
              activeTab === "all"
                ? "No reservations found"
                : `No ${activeTab} reservations`
            }
            description={
              activeTab === "all"
                ? "You haven't requested any bookings yet. Explore accredited homestays and resorts in Bretania to plan your next island trip."
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
              <BookingCard
                key={booking.id}
                booking={booking}
                onCancelBooking={handleCancelBooking}
                onViewBoardingPass={(b) =>
                  setSelectedPassBooking({
                    id: b.id,
                    property_name: b.property_name,
                    room_name: b.room_name,
                    guest_name: "Tourist Guest",
                    check_in: b.check_in_date,
                    check_out: b.check_out_date,
                    guests_count: b.guest_count,
                    total_price: b.total_price,
                    status: b.status,
                  })
                }
                onPayDeposit={(b) => setSelectedDepositBooking(b)}
                onRateStay={(b) => setSelectedReviewBooking(b)}
              />
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
        booking={selectedDepositBooking}
        onSuccess={fetchBookings}
      />

      {/* Rate Stay Modal */}
      <TouristReviewModal
        isOpen={!!selectedReviewBooking}
        onClose={() => setSelectedReviewBooking(null)}
        booking={selectedReviewBooking}
      />
    </div>
  );
}
