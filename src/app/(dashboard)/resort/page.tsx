"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  BedDouble,
  DollarSign,
  Users,
  TrendingUp,
  ExternalLink,
  Edit,
  Clock,
  ArrowDownRight,
  RefreshCw,
  Ship,
  Receipt,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PropertyFormModal,
} from "@/components/owner/property-form-modal";
import { RoomFormModal } from "@/components/owner/room-form-modal";
import { DuesPaymentModal } from "@/components/owner/dues-payment-modal";
import { WeatherAlertBanner } from "@/components/shared/weather-alert-banner";

export default function ResortDashboardPage() {
  const [property, setProperty] = React.useState<any>(null);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [bookings, setBookings] = React.useState<any[]>([]);
  const [services, setServices] = React.useState<any[]>([]);
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

      // 1. Fetch Resort Property
      const { data: propData } = await supabase
        .from("properties")
        .select("*")
        .eq("owner_id", user.id)
        .eq("type", "resort")
        .limit(1);

      const ownerResort = propData && propData.length > 0 ? (propData as any[])[0] : null;
      setProperty(ownerResort);

      if (ownerResort) {
        // 2. Fetch Rooms
        const { data: roomsData } = await supabase
          .from("rooms")
          .select("*")
          .eq("property_id", ownerResort.id);

        setRooms((roomsData as any[]) || []);
        const roomIds = ((roomsData as any[]) || []).map((r) => r.id);

        // 3. Fetch Bookings
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

          setBookings((bookingsData as any[]) || []);
        }

        // 4. Fetch Extra Services
        const { data: servicesData } = await supabase
          .from("extra_services")
          .select("*")
          .eq("property_id", ownerResort.id);

        setServices((servicesData as any[]) || []);
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

  // Compute key analytics
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const confirmedBookings = bookings.filter((b) => b.status === "accepted" || b.status === "completed");
  const pendingBookings = bookings.filter((b) => b.status === "pending");

  const totalRevenue = confirmedBookings.reduce(
    (sum, b) => sum + Number(b.total_price || 0),
    0
  );
  const totalGuests = confirmedBookings.reduce(
    (sum, b) => sum + Number(b.guest_count || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
              Resort Operations Center
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            Monitor occupancy, villa inventory, boat transfers, and island tour packages
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
              Add Room / Villa
            </Button>
          ) : (
            <Button
              onClick={() => setIsPropertyModalOpen(true)}
              className="bg-black text-white hover:bg-neutral-800 text-xs h-9 px-4 font-semibold"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              List Resort
            </Button>
          )}
        </div>
      </div>

      {/* Coast Guard Gale Warning & Weather Alert */}
      <WeatherAlertBanner />

      {!property ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 p-8 sm:p-12 text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-neutral-200 mx-auto shadow-xs">
            <Building2 className="h-6 w-6 text-neutral-800" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-neutral-900">
              Set up your resort storefront
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              List your resort to start receiving tourist room reservations and managing island hopping boat tour bookings in Bretania.
            </p>
          </div>
          <Button
            onClick={() => setIsPropertyModalOpen(true)}
            className="bg-black text-white hover:bg-neutral-800 text-xs h-10 px-5 font-semibold"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Publish Resort to Marketplace
          </Button>
        </div>
      ) : (
        <>
          {/* Active Resort Card */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800 shrink-0">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-neutral-900">
                    {property.name}
                  </h2>
                  <Badge variant="success" size="sm" dot>
                    Accredited Resort
                  </Badge>
                </div>
                <p className="text-xs text-neutral-600">
                  {property.address || "Bretania Islands, San Agustin"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPropertyModalOpen(true)}
                className="text-xs h-8 px-3 border-neutral-200"
              >
                <Edit className="h-3.5 w-3.5 mr-1" />
                Edit Resort
              </Button>

              <Link
                href={`/property/${property.id}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-900 border border-neutral-200 hover:bg-neutral-50 h-8 px-3 rounded-md transition-colors"
              >
                <span>View Resort front</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Key Analytics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Total Bookings
                </span>
                <Users className="h-4 w-4 text-neutral-500" />
              </div>
              <p className="text-2xl font-bold text-neutral-900">
                {confirmedBookings.length}
              </p>
              <p className="text-xs text-neutral-600">
                {totalGuests} total guests accommodated
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Confirmed Revenue
                </span>
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-neutral-900">
                ₱{totalRevenue.toLocaleString()}
              </p>
              <span className="text-xs text-neutral-500">
                All-time reservation value
              </span>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Active Rooms / Villas
                </span>
                <BedDouble className="h-4 w-4 text-neutral-500" />
              </div>
              <p className="text-2xl font-bold text-neutral-900">
                {rooms.length}
              </p>
              <Link
                href="/resort/rooms"
                className="text-xs text-neutral-600 hover:text-black font-medium inline-block"
              >
                Manage villas &rarr;
              </Link>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Pending Inquiries
                </span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-neutral-900">
                {pendingBookings.length}
              </p>
              <span className="text-xs text-neutral-600">
                Awaiting your approval
              </span>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/resort/services"
              className="rounded-xl border border-neutral-200 p-5 bg-white hover:border-neutral-300 transition-all flex items-center justify-between group"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Ship className="h-4 w-4 text-neutral-800" />
                  <h3 className="font-bold text-sm text-neutral-900 group-hover:text-black">
                    Boat Tours & Extra Services
                  </h3>
                </div>
                <p className="text-xs text-neutral-600">
                  {services.length} island packages and boat tour services active
                </p>
              </div>
              <Button variant="outline" size="sm" className="text-xs border-neutral-200">
                Manage Services
              </Button>
            </Link>

            <Link
              href="/resort/rooms"
              className="rounded-xl border border-neutral-200 p-5 bg-white hover:border-neutral-300 transition-all flex items-center justify-between group"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <BedDouble className="h-4 w-4 text-neutral-800" />
                  <h3 className="font-bold text-sm text-neutral-900 group-hover:text-black">
                    Villa & Room Inventory
                  </h3>
                </div>
                <p className="text-xs text-neutral-600">
                  {rooms.length} room categories configured
                </p>
              </div>
              <Button variant="outline" size="sm" className="text-xs border-neutral-200">
                Manage Inventory
              </Button>
            </Link>

            {/* Association Dues Quick Card */}
            <div
              className="rounded-xl border border-neutral-200 p-5 bg-white flex items-center justify-between group opacity-50 cursor-not-allowed pointer-events-none"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-neutral-800" />
                  <h3 className="font-bold text-sm text-neutral-900">
                    Association Dues
                  </h3>
                  <Badge variant="subtle" size="sm">₱1,500/mo</Badge>
                </div>
                <p className="text-xs text-neutral-600">
                  Submit monthly GCash / bank payment receipt (Disabled)
                </p>
              </div>
              <Button variant="outline" size="sm" className="text-xs border-neutral-200" disabled>
                Upload Receipt
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <PropertyFormModal
        isOpen={isPropertyModalOpen}
        onClose={() => setIsPropertyModalOpen(false)}
        onSuccess={fetchData}
        initialData={property}
        defaultType="resort"
      />

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
        role="resort"
        propertyName={property?.name || "Resort Property"}
      />
    </div>
  );
}
