"use client";

import * as React from "react";
import Link from "next/link";
import {
  Home,
  Plus,
  BedDouble,
  Ticket,
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  Edit,
  Clock,
  CheckCircle2,
  RefreshCw,
  Users,
  Receipt,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PropertyFormModal,
  type PropertyFormData,
} from "@/components/owner/property-form-modal";
import { RoomFormModal } from "@/components/owner/room-form-modal";
import { DuesPaymentModal } from "@/components/owner/dues-payment-modal";
import { WeatherAlertBanner } from "@/components/shared/weather-alert-banner";

export default function HomestayDashboardPage() {
  const [property, setProperty] = React.useState<any>(null);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [bookings, setBookings] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Modals
  const [isPropertyModalOpen, setIsPropertyModalOpen] = React.useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = React.useState(false);
  const [isDuesModalOpen, setIsDuesModalOpen] = React.useState(false);

  const fetchData = React.useCallback(async () => {
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

      // 1. Fetch Owner's Homestay Property
      const { data: propertiesData } = await supabase
        .from("properties")
        .select("*")
        .eq("owner_id", user.id)
        .eq("type", "homestay")
        .limit(1);

      const ownerProperty = propertiesData && propertiesData.length > 0 ? (propertiesData as any[])[0] : null;
      setProperty(ownerProperty);

      if (ownerProperty) {
        // 2. Fetch Rooms for this property
        const { data: roomsData } = await supabase
          .from("rooms")
          .select("*")
          .eq("property_id", ownerProperty.id);

        setRooms((roomsData as any[]) || []);

        const roomIds = ((roomsData as any[]) || []).map((r) => r.id);

        // 3. Fetch Bookings for these rooms
        if (roomIds.length > 0) {
          const { data: bookingsData } = await supabase
            .from("bookings")
            .select(`
              *,
              profiles!tourist_id(full_name, phone_number),
              rooms!room_id(name)
            `)
            .in("room_id", roomIds)
            .order("created_at", { ascending: false });

          setBookings(bookingsData || []);
        } else {
          setBookings([]);
        }
      }
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const today = new Date().toISOString().split("T")[0];

  const todayCheckIns = bookings.filter(
    (b) => b.check_in_date === today && b.status === "accepted"
  );
  const todayCheckOuts = bookings.filter(
    (b) => b.check_out_date === today && b.status === "accepted"
  );
  const pendingRequests = bookings.filter((b) => b.status === "pending");

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
              Homestay Operations Center
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            Manage your homestay listing, add rooms, and approve guest bookings in Bretania
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            title="Refresh"
            className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          {property ? (
            <Button
              onClick={() => setIsRoomModalOpen(true)}
              className="bg-black text-white hover:bg-neutral-800 text-xs h-9 px-4 font-semibold"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Room
            </Button>
          ) : (
            <Button
              onClick={() => setIsPropertyModalOpen(true)}
              className="bg-black text-white hover:bg-neutral-800 text-xs h-9 px-4 font-semibold"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              List Homestay
            </Button>
          )}
        </div>
      </div>

      {/* Coast Guard Gale Warning & Weather Alert */}
      <WeatherAlertBanner />

      {/* Property Setup State */}
      {!property ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 p-8 sm:p-12 text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-neutral-200 mx-auto shadow-xs">
            <Home className="h-6 w-6 text-neutral-800" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-neutral-900">
              You haven&apos;t listed your homestay yet
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              Create your homestay storefront so tourists can discover your rooms, view island photos, and send reservation requests.
            </p>
          </div>
          <Button
            onClick={() => setIsPropertyModalOpen(true)}
            className="bg-black text-white hover:bg-neutral-800 text-xs h-10 px-5 font-semibold"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Set Up My Homestay Listing
          </Button>
        </div>
      ) : (
        <>
          {/* Active Property Banner */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800 shrink-0">
                <Home className="h-6 w-6" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-neutral-900">
                    {property.name}
                  </h2>
                  <Badge variant="success" size="sm" dot>
                    Live on Marketplace
                  </Badge>
                </div>
                <p className="text-xs text-neutral-600">
                  {property.address || "Bretania, San Agustin"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPropertyModalOpen(true)}
                className="text-xs h-8 px-3 border-neutral-200 text-neutral-700"
              >
                <Edit className="h-3.5 w-3.5 mr-1" />
                Edit Details
              </Button>

              <Link
                href={`/property/${property.id}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-900 border border-neutral-200 hover:bg-neutral-50 h-8 px-3 rounded-md transition-colors"
              >
                <span>View Storefront</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Listed Rooms
                </span>
                <BedDouble className="h-4 w-4 text-neutral-500" />
              </div>
              <p className="text-2xl font-bold text-neutral-900">
                {rooms.length} {rooms.length === 1 ? "Room" : "Rooms"}
              </p>
              <Link
                href="/homestay/rooms"
                className="text-xs text-neutral-600 hover:text-black font-medium inline-block"
              >
                Manage room inventory &rarr;
              </Link>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Pending Approvals
                </span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-neutral-900">
                {pendingRequests.length}
              </p>
              <Link
                href="/homestay/bookings"
                className="text-xs text-neutral-600 hover:text-black font-medium inline-block"
              >
                Review guest requests &rarr;
              </Link>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Today&apos;s Arrivals
                </span>
                <ArrowDownRight className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-neutral-900">
                {todayCheckIns.length}
              </p>
              <span className="text-xs text-neutral-600">
                Departures today: {todayCheckOuts.length}
              </span>
            </div>

            {/* Association Dues Widget */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Association Dues
                </span>
                <Receipt className="h-4 w-4 text-neutral-600" />
              </div>
              <p className="text-2xl font-bold text-neutral-900">
                ₱500 <span className="text-xs text-neutral-500 font-normal">/ mo</span>
              </p>
              <button
                type="button"
                onClick={() => setIsDuesModalOpen(true)}
                className="text-xs text-neutral-800 hover:text-black font-bold flex items-center gap-1"
              >
                <span>Upload GCash Receipt</span> &rarr;
              </button>
            </div>
          </div>

          {/* Today's Schedule Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Check-ins */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-emerald-600" />
                  <h3 className="font-semibold text-sm text-neutral-900">
                    Arriving Guests Today
                  </h3>
                </div>
                <Badge variant="subtle" size="sm">
                  {todayCheckIns.length} Expected
                </Badge>
              </div>

              {todayCheckIns.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  No guest check-ins scheduled for today
                </div>
              ) : (
                <div className="space-y-2">
                  {todayCheckIns.map((booking) => (
                    <div
                      key={booking.id}
                      className="p-3 rounded-lg border border-neutral-100 bg-neutral-50 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-neutral-900">
                          {booking.profiles?.full_name || "Guest"}
                        </p>
                        <p className="text-neutral-600 text-[11px]">
                          {booking.rooms?.name} • {booking.guest_count} guests
                        </p>
                      </div>
                      <Badge variant="success" size="sm">
                        Confirmed
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Check-outs */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-neutral-600" />
                  <h3 className="font-semibold text-sm text-neutral-900">
                    Departing Guests Today
                  </h3>
                </div>
                <Badge variant="subtle" size="sm">
                  {todayCheckOuts.length} Departing
                </Badge>
              </div>

              {todayCheckOuts.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  No check-outs scheduled for today
                </div>
              ) : (
                <div className="space-y-2">
                  {todayCheckOuts.map((booking) => (
                    <div
                      key={booking.id}
                      className="p-3 rounded-lg border border-neutral-100 bg-neutral-50 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-neutral-900">
                          {booking.profiles?.full_name || "Guest"}
                        </p>
                        <p className="text-neutral-600 text-[11px]">
                          {booking.rooms?.name}
                        </p>
                      </div>
                      <span className="text-[11px] text-neutral-600">
                        Check-out by 12:00 PM
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Property Form Modal */}
      <PropertyFormModal
        isOpen={isPropertyModalOpen}
        onClose={() => setIsPropertyModalOpen(false)}
        onSuccess={fetchData}
        initialData={property}
        defaultType="homestay"
      />

      {/* Room Form Modal */}
      {property && (
        <RoomFormModal
          isOpen={isRoomModalOpen}
          onClose={() => setIsRoomModalOpen(false)}
          onSuccess={fetchData}
          propertyId={property.id}
        />
      )}

      {/* Association Dues Payment Modal */}
      <DuesPaymentModal
        isOpen={isDuesModalOpen}
        onClose={() => setIsDuesModalOpen(false)}
        onSuccess={fetchData}
        role="homestay"
        propertyName={property?.name || "Homestay Listing"}
      />
    </div>
  );
}
