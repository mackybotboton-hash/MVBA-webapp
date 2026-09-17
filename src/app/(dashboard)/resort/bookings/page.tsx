"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Ticket,
  Clock,
  CheckCircle2,
  XCircle,
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

type BookingTab = "all" | "pending" | "accepted" | "declined" | "completed";

export default function ResortBookingsPage() {
  const [bookings, setBookings] = React.useState<OwnerBookingItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<BookingTab>("pending");
  const [isScannerOpen, setIsScannerOpen] = React.useState(false);

  const fetchBookings = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      // 1. Get owner's resort properties
      const { data: propData } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", user.id)
        .eq("type", "resort");

      const propIds = ((propData as any[]) || []).map((p) => p.id);

      if (propIds.length === 0) {
        setBookings([]);
        setIsLoading(false);
        return;
      }

      // 2. Get rooms for these properties
      const { data: roomsData } = await supabase
        .from("rooms")
        .select("id, name")
        .in("property_id", propIds);

      const roomIds = ((roomsData as any[]) || []).map((r) => r.id);

      if (roomIds.length === 0) {
        setBookings([]);
        setIsLoading(false);
        return;
      }

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

      const mapped: OwnerBookingItem[] = (bookingsData || []).map((b: any) => ({
        id: b.id,
        tourist_id: b.tourist_id,
        tourist_name: b.profiles?.full_name || "Tourist Guest",
        tourist_phone: b.profiles?.phone_number || "",
        tourist_email: b.profiles?.email || "",
        room_id: b.room_id,
        room_name: b.rooms?.name || "Resort Suite / Villa",
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

      setBookings(mapped);
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleUpdateStatus = async (
    bookingId: string,
    newStatus: "accepted" | "declined"
  ) => {
    try {
      const supabase = createClient();
      const { error } = await (supabase.from("bookings") as any)
        .update({ status: newStatus })
        .eq("id", bookingId);

      if (error) throw error;

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
      );

      toast.success(
        newStatus === "accepted"
          ? "Resort reservation confirmed!"
          : "Reservation declined."
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update reservation");
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
      declined: bookings.filter((b) => b.status === "declined").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
      completed: bookings.filter((b) => b.status === "completed").length,
    };
  }, [bookings]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Resort Reservations
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            Manage villa bookings, confirm guest requests, and track arrival logistics
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
            onClick={fetchBookings}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-black self-start sm:self-auto px-2 py-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
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

      {/* Content */}
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
              ? "No pending resort reservations"
              : `No ${activeTab} reservations found`
          }
          description={
            activeTab === "pending"
              ? "Guest booking requests from tourists browsing the marketplace will arrive here for your confirmation."
              : `You do not have any reservations marked as ${activeTab}.`
          }
          actionLabel="Refresh List"
          onAction={fetchBookings}
        />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <OwnerBookingCard
              key={booking.id}
              booking={booking}
              onUpdateStatus={handleUpdateStatus}
              chatHrefPrefix="/resort/chat"
            />
          ))}
        </div>
      )}

      {/* QR Check-in Scanner Modal */}
      <QRCheckinScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onCheckinSuccess={() => fetchBookings()}
        bookings={bookings}
      />
    </div>
  );
}
