"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Ticket,
  RefreshCw,
  QrCode,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  OwnerBookingCard,
  type OwnerBookingItem,
} from "@/components/owner/owner-booking-card";
import { EmptyState } from "@/components/tourist/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { QRCheckinScannerModal } from "@/components/owner/qr-checkin-scanner-modal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeBookings } from "@/hooks/use-realtime-bookings";
import { markBookingsAsSeen } from "@/hooks/use-notification-counts";
import { notifyBookingStatusChange } from "@/app/actions/notify-actions";

type BookingTab = "all" | "pending" | "accepted" | "declined" | "completed";

async function fetchHomestayBookings(userId: string): Promise<OwnerBookingItem[]> {
  const supabase = createClient();

  // 1. Get owner's homestay properties
  const { data: propData } = await supabase
    .from("properties")
    .select("id, name")
    .eq("owner_id", userId)
    .eq("type", "homestay");

  const propIds = ((propData as any[]) || []).map((p) => p.id);
  if (propIds.length === 0) return [];

  // 2. Get rooms for these properties
  const { data: roomsData } = await supabase
    .from("rooms")
    .select("id, name")
    .in("property_id", propIds);

  const roomIds = ((roomsData as any[]) || []).map((r) => r.id);
  if (roomIds.length === 0) return [];

  // 3. Get bookings for these rooms
  const { data: bookingsData, error } = await supabase
    .from("bookings")
    .select(`
      id,
      tourist_id,
      room_id,
      check_in_date,
      check_out_date,
      guest_count,
      total_price,
      downpayment_amount,
      host_payout_amount,
      status,
      payout_status,
      created_at,
      notes,
      profiles!tourist_id(full_name, phone_number, email),
      rooms!room_id(name)
    `)
    .in("room_id", roomIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((bookingsData || []) as any[]).map((b) => ({
    id: b.id,
    tourist_id: b.tourist_id,
    tourist_name: b.profiles?.full_name || "Tourist Guest",
    tourist_phone: b.profiles?.phone_number || "",
    tourist_email: b.profiles?.email || "",
    room_id: b.room_id,
    room_name: b.rooms?.name || "Homestay Room",
    check_in_date: b.check_in_date,
    check_out_date: b.check_out_date,
    guest_count: b.guest_count,
    total_price: Number(b.total_price),
    downpayment_amount: b.downpayment_amount ? Number(b.downpayment_amount) : undefined,
    host_payout_amount: b.host_payout_amount ? Number(b.host_payout_amount) : undefined,
    status: b.status,
    payout_status: b.payout_status,
    created_at: b.created_at,
    notes: b.notes,
  }));
}

export default function HomestayBookingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<BookingTab>("pending");
  const [isScannerOpen, setIsScannerOpen] = React.useState(false);

  // React Query — data fetching with cache
  const { data: bookings = [], isLoading, refetch } = useQuery({
    queryKey: ["homestay-bookings", user?.id],
    queryFn: () => fetchHomestayBookings(user!.id),
    enabled: !!user?.id,
  });

  // Supabase Realtime — invalidate on INSERT/UPDATE to owner's bookings
  useRealtimeBookings(user?.id, "host", ["homestay-bookings"]);

  // Mark all unseen bookings as seen when the host opens this page
  React.useEffect(() => {
    if (user?.id) {
      markBookingsAsSeen(user.id);
    }
  }, [user?.id]);

  const handleUpdateStatus = React.useCallback(async (
    bookingId: string,
    newStatus: "accepted" | "declined"
  ) => {
    try {
      const supabase = createClient();

      // Fetch booking details before updating (for notification)
      const booking = bookings.find((b) => b.id === bookingId);

      const { error } = await (supabase.from("bookings") as any)
        .update({ status: newStatus })
        .eq("id", bookingId);

      if (error) throw error;

      // Optimistic UI update
      queryClient.setQueryData(
        ["homestay-bookings", user?.id],
        (old: OwnerBookingItem[] | undefined) =>
          (old || []).map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
      );

      toast.success(
        newStatus === "accepted"
          ? "Booking accepted! Guest reservation confirmed."
          : "Booking request declined."
      );

      // Fire-and-forget: notify the tourist
      if (booking) {
        notifyBookingStatusChange({
          touristId: booking.tourist_id,
          newStatus,
          propertyName: booking.room_name,
          checkIn: booking.check_in_date,
        }).catch((err) => console.error("[Notify] status change notify failed:", err));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update booking status");
    }
  }, [bookings, queryClient, user]);

  const filteredBookings = React.useMemo(() => {
    if (activeTab === "all") return bookings;
    return bookings.filter((b) => b.status === activeTab);
  }, [bookings, activeTab]);

  const counts = React.useMemo(() => ({
    all: bookings.length,
    pending: bookings.filter((b) => b.status === "pending").length,
    accepted: bookings.filter((b) => b.status === "accepted").length,
    declined: bookings.filter((b) => b.status === "declined").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
    completed: bookings.filter((b) => b.status === "completed").length,
  }), [bookings]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Guest Booking Requests
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            Accept or decline reservations and coordinate guest arrivals in Bretania
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsScannerOpen(true)}
            className="bg-black text-white hover:bg-neutral-800 text-xs h-9 px-3.5 font-bold flex items-center gap-1.5"
          >
            <QrCode className="h-4 w-4" />
            <span>Scan / Verify QR Pass</span>
          </Button>

          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-black self-start sm:self-auto px-2 py-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Status Segment Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide border-b border-neutral-200 pb-2">
        {[
          { id: "pending", label: "Pending Requests", count: counts.pending },
          { id: "accepted", label: "Confirmed", count: counts.accepted },
          { id: "all", label: "All Bookings", count: counts.all },
          { id: "declined", label: "Declined", count: counts.declined },
          { id: "cancelled", label: "Cancelled", count: counts.cancelled },
          { id: "completed", label: "Completed", count: counts.completed },
        ].map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as BookingTab)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 ${
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

      {/* Bookings Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4"
            >
              <Skeleton className="h-5 w-48" />
              <div className="grid grid-cols-3 gap-4 py-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={
            activeTab === "pending"
              ? "No pending booking requests"
              : `No ${activeTab} reservations found`
          }
          description={
            activeTab === "pending"
              ? "When tourists browse the marketplace and request a room at your homestay, their requests will appear here for you to accept or decline."
              : `You do not currently have any bookings marked as ${activeTab}.`
          }
          actionLabel="Refresh List"
          onAction={() => refetch()}
        />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <OwnerBookingCard
              key={booking.id}
              booking={booking}
              onUpdateStatus={handleUpdateStatus}
              chatHrefPrefix="/homestay/chat"
            />
          ))}
        </div>
      )}

      {/* QR Check-in Scanner Modal */}
      <QRCheckinScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onCheckinSuccess={() => refetch()}
        bookings={bookings}
      />
    </div>
  );
}
