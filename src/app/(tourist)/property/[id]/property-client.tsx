"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Heart,
  MapPin,
  Star,
  Users,
  Calendar,
  Share2,
  ShieldCheck,
  Check,
  BedDouble,
  Ship,
  Sparkles,
  Phone,
  Clock,
  ChevronRight,
  ChevronLeft,
  Camera,
  Info,
  X,
  Eye,
  AlertTriangle,
  PlaySquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LoadingLogo } from "@/components/shared/loading-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SocialVideoEmbed } from "@/components/ui/social-video-embed";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { addDays } from "date-fns";

import { useWishlist } from "@/hooks/use-wishlist";
import { cn } from "@/lib/utils";
import { ShareButton } from "@/components/tourist/share-button";
import { AuthModal } from "@/components/auth/auth-modal";

interface RoomItem {
  id: string;
  name: string;
  description: string;
  base_price: number;
  max_capacity: number;
  is_active: boolean;
  image_url?: string;
  room_images?: { id?: string; image_url: string }[];
}

export default function PropertyStorefrontPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params?.id as string;
  const { isSaved, toggleSave } = useWishlist();

  const [property, setProperty] = React.useState<any>(null);
  const [rooms, setRooms] = React.useState<RoomItem[]>([]);
  const [services, setServices] = React.useState<any[]>([]);
  const [reviews, setReviews] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const isFavorited = isSaved(propertyId);
  const [activeTab, setActiveTab] = React.useState<"overview" | "rooms" | "services" | "reviews">("overview");

  // Booking Modal State
  const [user, setUser] = React.useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
  const [pendingRoomToBook, setPendingRoomToBook] = React.useState<RoomItem | null>(null);
  const [selectedRoom, setSelectedRoom] = React.useState<RoomItem | null>(null);
  const [gallery, setGallery] = React.useState<{
    isOpen: boolean;
    roomName: string;
    images: string[];
    currentIndex: number;
  }>({
    isOpen: false,
    roomName: "",
    images: [],
    currentIndex: 0,
  });
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 2),
  });
  
  const checkInDate = dateRange?.from ? dateRange.from.toISOString().split("T")[0] : "";
  const checkOutDate = dateRange?.to ? dateRange.to.toISOString().split("T")[0] : "";
  
  const [guestCount, setGuestCount] = React.useState(2);
  const [arrivalTime, setArrivalTime] = React.useState("");
  const [selectedAddons, setSelectedAddons] = React.useState<string[]>([]); // array of service_ids
  const [isSubmittingBooking, setIsSubmittingBooking] = React.useState(false);

  // Concurrency & Double-Booking Protection State
  const [bookedRanges, setBookedRanges] = React.useState<{
    id: string;
    check_in_date: string;
    check_out_date: string;
    status: string;
  }[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = React.useState(false);

  // Load User Data
  React.useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    }
    fetchUser();
  }, []);

  // Fetch active booked dates for selected room to block conflicting dates
  React.useEffect(() => {
    if (!selectedRoom) {
      setBookedRanges([]);
      return;
    }

    const targetRoomId = selectedRoom.id;

    async function fetchRoomAvailability() {
      setIsLoadingAvailability(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("bookings")
          .select("id, check_in_date, check_out_date, status")
          .eq("room_id", targetRoomId)
          .in("status", ["accepted", "pending", "completed"]);

        setBookedRanges((data as any[]) || []);
      } catch {
        // Graceful fallback
      } finally {
        setIsLoadingAvailability(false);
      }
    }

    fetchRoomAvailability();
  }, [selectedRoom]);

  // High-performance memoized date conflict checker
  // Interval overlap: (A.start < B.end) AND (A.end > B.start)
  const conflictingBooking = React.useMemo(() => {
    if (!checkInDate || !checkOutDate || !bookedRanges.length) return null;
    if (checkInDate >= checkOutDate) return null;

    return bookedRanges.find((range) => {
      return checkInDate < range.check_out_date && checkOutDate > range.check_in_date;
    });
  }, [checkInDate, checkOutDate, bookedRanges]);

  const disabledDates = React.useMemo(() => {
    return bookedRanges.map(range => ({
      from: new Date(range.check_in_date),
      to: new Date(range.check_out_date)
    }));
  }, [bookedRanges]);

  // Fetch property details from Supabase with graceful sample fallback
  React.useEffect(() => {
    async function loadProperty() {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("properties")
          .select(`
            id,
            name,
            type,
            description,
            address,
            cover_image_url,
            promo_video_url,
            owner_id,
            policies,
            check_in_time,
            check_out_time,
            rooms (*, room_images(id, image_url, display_order)),
            extra_services (*),
            reviews (
              id, rating, comment, created_at,
              tourist:profiles(full_name, avatar_url)
            )
          `)
          .eq("id", propertyId)
          .single();

        if (error || !data) {
          setProperty(null);
          setRooms([]);
          setServices([]);
          setReviews([]);
        } else {
          setProperty(data);
          setRooms(((data as any).rooms as any[]) || []);
          setServices(((data as any).extra_services as any[]) || []);
          setReviews(((data as any).reviews as any[]) || []);
        }
      } catch {
        setProperty(null);
      } finally {
        setIsLoading(false);
      }
    }

    if (propertyId) {
      loadProperty();
    }
  }, [propertyId]);

  // Price calculations
  const calculateTotalNights = () => {
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diff = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff > 0 ? diff : 1;
  };

  const calculateTotalPrice = (roomPrice: number) => {
    let total = roomPrice * calculateTotalNights();
    selectedAddons.forEach(addonId => {
      const service = services.find(s => s.id === addonId);
      if (service) total += Number(service.price);
    });
    return total;
  };

  const handleCreateBooking = async () => {
    if (!selectedRoom) return;

    // 1. Client-Side Date Order Validation
    if (checkInDate >= checkOutDate) {
      toast.error("Invalid Date Selection", {
        description: "Check-out date must be at least 1 day after check-in date.",
      });
      return;
    }

    // 2. Client-Side Instant Conflict Rejection
    if (conflictingBooking) {
      toast.error("Dates Unavailable", {
        description: `This room is already reserved from ${conflictingBooking.check_in_date} to ${conflictingBooking.check_out_date}. Please pick other dates.`,
      });
      return;
    }

    setIsSubmittingBooking(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.info("Please sign in to confirm your booking", {
          description: "Redirecting to login...",
        });
        router.push(`/login?redirect=/property/${propertyId}`);
        return;
      }

      // 3. High-Concurrency Pre-Flight Database Overlap Check
      // Executed immediately before write to prevent millisecond race condition
      const { data: dbConflicts } = await supabase
        .from("bookings")
        .select("id, check_in_date, check_out_date, status")
        .eq("room_id", selectedRoom.id)
        .in("status", ["accepted", "pending", "completed"])
        .lt("check_in_date", checkOutDate)
        .gt("check_out_date", checkInDate);

      const conflictList = (dbConflicts as any[]) || [];
      if (conflictList.length > 0) {
        const conflict = conflictList[0];
        toast.error("Double-Booking Conflict Detected!", {
          description: `Another tourist just booked this room for ${conflict.check_in_date} to ${conflict.check_out_date} (${conflict.status}). Please choose alternative dates.`,
        });
        // Update local state so UI instantly reflects the new conflict
        setBookedRanges((prev) => [...prev, ...conflictList]);
        setIsSubmittingBooking(false);
        return;
      }

      const total = calculateTotalPrice(selectedRoom.base_price);
      const bookingNotes = arrivalTime ? `Estimated Arrival: ${arrivalTime}` : null;

      const downpayment = total * 0.20;
      const commission = total * 0.08;
      const host_payout = total * 0.12;

      // A. Try Atomic PostgreSQL Stored Procedure (ACID Row-Level Lock)
      try {
        const { data: rpcRes, error: rpcErr } = await (supabase.rpc as any)(
          "request_booking_atomic",
          {
            p_tourist_id: user.id,
            p_room_id: selectedRoom.id,
            p_check_in: checkInDate,
            p_check_out: checkOutDate,
            p_guest_count: guestCount,
            p_total_price: total,
            p_notes: bookingNotes,
          }
        );

        if (!rpcErr && rpcRes) {
          if (!rpcRes.success) {
            toast.error("Double-Booking Conflict!", {
              description: rpcRes.message || "These dates are already reserved.",
            });
            setIsSubmittingBooking(false);
            return;
          }

          await (supabase.from("bookings") as any).update({
            downpayment_amount: downpayment,
            commission_amount: commission,
            host_payout_amount: host_payout,
            payment_status: "awaiting_deposit",
          }).eq("id", rpcRes.booking_id);

          // Add-ons insertion
          if (selectedAddons.length > 0) {
            const addonsData = selectedAddons.map((addonId) => {
              const service = services.find((s) => s.id === addonId);
              return {
                booking_id: rpcRes.booking_id,
                service_id: addonId,
                price_at_booking: service ? Number(service.price) : 0,
              };
            });
            await (supabase.from("booking_addons") as any).insert(addonsData);
          }

          toast.success("Reservation request sent to host!", {
            description: "Check your bookings tab for confirmation updates.",
          });
          setSelectedRoom(null);
          router.push("/bookings");
          return;
        }
      } catch {
        // Fallback to client pre-flight + standard insert
      }

      // B. Fallback Standard Insert
      const { error, data: newBooking } = await (supabase.from("bookings") as any).insert({
        tourist_id: user.id,
        room_id: selectedRoom.id,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        guest_count: guestCount,
        total_price: total,
        downpayment_amount: downpayment,
        commission_amount: commission,
        host_payout_amount: host_payout,
        status: "pending",
        payment_status: "awaiting_deposit",
        notes: bookingNotes,
      }).select().single();

      if (error) {
        toast.error("Booking submission error", {
          description: error.message || "Failed to create reservation request.",
        });
        return;
      }

      // Add-ons insertion for standard fallback
      if (selectedAddons.length > 0 && newBooking) {
        const addonsData = selectedAddons.map((addonId) => {
          const service = services.find((s) => s.id === addonId);
          return {
            booking_id: newBooking.id,
            service_id: addonId,
            price_at_booking: service ? Number(service.price) : 0,
          };
        });
        await (supabase.from("booking_addons") as any).insert(addonsData);
      }

      toast.success("Reservation request sent to host!", {
        description: "The host has been notified. Track updates in My Bookings.",
      });

      setSelectedRoom(null);
      router.push("/bookings");
    } catch (err: any) {
      toast.error("Reservation Error", {
        description: err.message || "An unexpected error occurred while booking.",
      });
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <LoadingLogo size="large" />
        <p className="mt-6 text-sm font-semibold tracking-wider uppercase text-neutral-400 animate-pulse">Loading stay details...</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-3 px-4">
          <AlertTriangle className="h-10 w-10 text-neutral-300 mx-auto" />
          <h2 className="text-base font-bold text-neutral-900">Property Not Found</h2>
          <p className="text-xs text-neutral-600 max-w-xs mx-auto">
            This property may have been removed or does not exist. Please go back and browse available stays.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to All Stays
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-black transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Stays</span>
          </Link>

          <div className="flex items-center gap-2">
            {property && (
              <ShareButton 
                propertyId={propertyId} 
                propertyName={property.name} 
                propertyDescription={property.description}
              />
            )}
            <button
              onClick={() => {
                toggleSave(propertyId, property?.name);
              }}
              className="p-2 rounded-full border border-neutral-200 text-neutral-600 hover:bg-neutral-100 transition-colors"
              aria-label="Save property"
            >
              <Heart
                className={`h-4 w-4 transition-colors ${
                  isFavorited ? "fill-red-500 text-red-500" : "text-neutral-600"
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-8">
        {/* Visual Hero Gallery */}
        <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200">
          {property.cover_image_url ? (
            <Image
              src={property.cover_image_url}
              alt={property.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 100vw"
              priority
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-neutral-500">
              <span className="text-xl font-bold">{property.name}</span>
            </div>
          )}

          <div className="absolute top-4 left-4 flex gap-2">
            <Badge variant="default" className="capitalize text-xs">
              {property.type}
            </Badge>
            <Badge variant="subtle" className="bg-white/95 text-neutral-900 border-neutral-200">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 mr-1" />
              MVBA Verified
            </Badge>
          </div>
        </div>

        {/* Property Overview Header */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
              {property.name}
            </h1>

            <div className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span>
                {reviews.length > 0 
                  ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
                  : "New"}
              </span>
              <span className="text-xs text-neutral-600 font-normal">
                ({reviews.length} reviews)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-sm font-medium text-neutral-700">
            <MapPin className="h-4 w-4 text-neutral-700 shrink-0" />
            <span>{property.address || "Bretania Islands, San Agustin, Surigao del Sur"}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
          {[
            { id: "overview", label: "Overview & Policies" },
            { id: "rooms", label: "Available Rooms & Rates" },
            { id: "services", label: "Add-on Services" },
            { id: "reviews", label: "Guest Reviews" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-4 py-2 text-xs font-semibold rounded-lg transition-all",
                activeTab === tab.id
                  ? "bg-black text-white"
                  : "text-neutral-600 hover:text-black hover:bg-neutral-100"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {property.promo_video_url && (
              <div className="space-y-3">
                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-1.5">
                  <PlaySquare className="h-4 w-4 text-rose-500" />
                  Property Highlights Video
                </h2>
                <div className="max-w-xs sm:max-w-sm">
                  <SocialVideoEmbed url={property.promo_video_url} />
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <h2 className="text-base font-bold text-neutral-900">
                About this Property
              </h2>
              <p className="text-sm font-medium text-neutral-700 leading-relaxed max-w-3xl">
                {property.description}
              </p>
            </div>

            {/* Property Policies (Dynamic) */}
            {property.policies && (
              <div className="space-y-3 pt-4 border-t border-neutral-100">
                <h3 className="text-base font-bold text-neutral-900">House Rules</h3>
                
                <div className="flex items-center gap-4 text-sm font-medium text-neutral-700 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-neutral-500" />
                    <span>Check-in: {property.check_in_time || "14:00"}</span>
                  </div>
                  <div className="w-px h-4 bg-neutral-300"></div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-neutral-500" />
                    <span>Check-out: {property.check_out_time || "12:00"}</span>
                  </div>
                </div>

                {(() => {
                  try {
                    const pol = JSON.parse(property.policies);
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                        {pol.noSmoking && (
                          <div className="flex items-center gap-2 text-sm text-neutral-700">
                            <Check className="h-4 w-4 text-emerald-600" /> No Smoking indoors
                          </div>
                        )}
                        {pol.petsAllowed && (
                          <div className="flex items-center gap-2 text-sm text-neutral-700">
                            <Check className="h-4 w-4 text-emerald-600" /> Pets Allowed
                          </div>
                        )}
                        {pol.partiesAllowed && (
                          <div className="flex items-center gap-2 text-sm text-neutral-700">
                            <Check className="h-4 w-4 text-emerald-600" /> Parties/Events Allowed
                          </div>
                        )}
                        {pol.quietHours && (
                          <div className="flex items-center gap-2 text-sm text-neutral-700">
                            <Check className="h-4 w-4 text-emerald-600" /> Quiet hours after 10 PM
                          </div>
                        )}
                        {pol.customRules && (
                          <div className="col-span-1 sm:col-span-2 p-4 bg-amber-50/50 rounded-xl border border-amber-100 mt-2">
                            <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Host's Custom Rules</h4>
                            <p className="text-sm text-amber-900/80 whitespace-pre-wrap">{pol.customRules}</p>
                          </div>
                        )}
                      </div>
                    );
                  } catch(e) { return null; }
                })()}
              </div>
            )}

            {/* Association Checklist */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700">
                MVBA Verified Association Standards
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-700">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Standardized environmental & boat safety equipment</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Municipal tourism certified sanitary facilities</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Transparent rates with zero hidden island landing fees</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Emergency contact coordination with San Agustin MDRRMO</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Available Rooms */}
        {activeTab === "rooms" && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-neutral-900">
              Select an Accommodation
            </h2>

            <div className="grid grid-cols-1 gap-4">
              {rooms.map((room) => {
                const allRoomImages =
                  room.room_images && room.room_images.length > 0
                    ? room.room_images.map((img) => img.image_url)
                    : room.image_url
                    ? [room.image_url]
                    : [
                        "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
                        "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80",
                        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
                        "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80",
                        "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=800&q=80",
                      ];

                const coverImage = allRoomImages[0];

                return (
                  <div
                    key={room.id}
                    className="rounded-2xl border border-neutral-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 hover:border-neutral-300 transition-all bg-white shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
                      {/* Room Photo Thumbnail with Multi-Photo Badge */}
                      <div
                        onClick={() =>
                          setGallery({
                            isOpen: true,
                            roomName: room.name,
                            images: allRoomImages,
                            currentIndex: 0,
                          })
                        }
                        className="relative h-36 sm:h-28 w-full sm:w-44 rounded-xl overflow-hidden bg-neutral-100 shrink-0 cursor-pointer group border border-neutral-200"
                        title="Click to view all photo angles & amenities"
                      >
                        <Image
                          src={coverImage}
                          alt={room.name}
                          fill
                          sizes="(max-width: 768px) 100vw, 200px"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          <span>View {allRoomImages.length} Photos</span>
                        </div>

                        {/* Photos count pill */}
                        <div className="absolute bottom-1.5 right-1.5 bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
                          <Camera className="h-3 w-3" />
                          <span>{allRoomImages.length} Photos</span>
                        </div>
                      </div>

                      {/* Room Details */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-neutral-900 leading-snug">
                            {room.name}
                          </h3>
                        </div>
                        <p className="text-xs text-neutral-600 leading-relaxed line-clamp-2">
                          {room.description || "Comfortable accommodation with island breeze and amenities."}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs text-neutral-600 font-semibold">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5 text-neutral-600" />
                            <span className="text-sm font-medium text-neutral-700">
                              Maximum of {room.max_capacity} {room.max_capacity === 1 ? "Guest" : "Guests"}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setGallery({
                                isOpen: true,
                                roomName: room.name,
                                images: allRoomImages,
                                currentIndex: 0,
                              })
                            }
                            className="text-neutral-800 hover:text-black hover:underline font-bold text-[11px] flex items-center gap-1"
                          >
                            <span>Browse all angles & amenities</span> &rarr;
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center sm:flex-col sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-neutral-100">
                      <div>
                        <span className="text-lg font-bold text-neutral-900">
                          ₱{Number(room.base_price).toLocaleString()}
                        </span>
                        <span className="text-xs text-neutral-600 font-medium"> / night</span>
                      </div>

                      <Button
                        onClick={() => {
                          if (!user) {
                            setPendingRoomToBook(room);
                            setIsAuthModalOpen(true);
                          } else {
                            setSelectedRoom(room);
                          }
                        }}
                        className="bg-black text-white hover:bg-neutral-800 text-xs h-9 px-4 font-bold shadow-xs"
                      >
                        Book Room
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Island Services */}
        {activeTab === "services" && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-neutral-900">
              Additional Services & Packages
            </h2>
            
            {services.length === 0 ? (
              <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-neutral-200 border-dashed">
                <Ship className="h-8 w-8 text-neutral-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-neutral-600">No extra services listed currently.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {services.map((service) => {
                  const typeIcons: any = { boat: Ship, tour: MapPin, food: Ship, spa: Sparkles };
                  const Icon = typeIcons[service.service_type] || Sparkles;
                  return (
                    <div
                      key={service.id}
                      className="rounded-xl border border-neutral-200 p-5 space-y-2 bg-neutral-50/50"
                    >
                      <div className="flex items-center justify-between">
                        <Icon className="h-5 w-5 text-neutral-800" />
                        <Badge variant={service.payment_type === "upfront" ? "default" : "secondary"} size="sm" className="text-[10px]">
                          {service.payment_type === "upfront" ? "Pay Online" : "Pay at Property"}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-sm text-neutral-900 mt-2">
                        {service.name}
                      </h3>
                      {service.description && (
                        <p className="text-xs text-neutral-600 line-clamp-3">{service.description}</p>
                      )}
                      <p className="text-sm font-bold text-neutral-900 pt-1 border-t border-neutral-100 mt-3">
                        ₱{Number(service.price).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Reviews */}
        {activeTab === "reviews" && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-1.5 text-2xl font-bold text-neutral-900">
                <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
                <span>
                  {reviews.length > 0 
                    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
                    : "New"}
                </span>
              </div>
              <div className="h-6 w-px bg-neutral-300"></div>
              <p className="text-sm font-medium text-neutral-600">{reviews.length} total reviews</p>
            </div>

            {reviews.length === 0 ? (
              <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-neutral-200 border-dashed">
                <p className="text-sm font-medium text-neutral-600">Be the first to leave a review after your stay!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="p-5 rounded-xl border border-neutral-200 bg-white shadow-xs">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-full bg-neutral-200 overflow-hidden flex-shrink-0">
                        {review.tourist?.avatar_url ? (
                          <img src={review.tourist.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-black text-white font-bold">
                            {review.tourist?.full_name?.charAt(0) || "T"}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-neutral-900">{review.tourist?.full_name || "Guest"}</p>
                        <p className="text-[11px] text-neutral-500">
                          {new Date(review.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div className="ml-auto flex text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < review.rating ? "fill-current" : "text-neutral-200"}`} />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-neutral-700 leading-relaxed">
                        {review.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Booking Dialog Modal */}
      {selectedRoom && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setSelectedRoom(null)}
          />

          <div className="relative w-full max-w-md rounded-2xl bg-white border border-neutral-200 shadow-2xl p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 sticky top-0 bg-white z-10 -mt-1 pt-1">
              <div>
                <h3 className="font-bold text-lg text-neutral-900">
                  Request Reservation
                </h3>
                <p className="text-sm font-medium text-neutral-700">{selectedRoom.name}</p>
              </div>
              <button
                onClick={() => setSelectedRoom(null)}
                className="p-1 rounded-full text-neutral-600 hover:text-black"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Custom Inline Calendar */}
              <div className="rounded-xl border border-neutral-200 overflow-hidden flex justify-center bg-white p-1">
                <CalendarComponent
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                  disabled={[{ before: new Date() }, ...disabledDates]}
                  className="w-full max-w-[280px] sm:max-w-none flex justify-center"
                />
              </div>

              {checkInDate >= checkOutDate && dateRange?.to && (
                <span className="text-[10px] text-red-600 mt-1 block font-semibold text-center">
                  Check-out date must be after check-in date.
                </span>
              )}

              <div>
                <label className="font-medium text-neutral-700 block mb-1.5">
                  Number of Guests
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedRoom.max_capacity}
                  value={guestCount}
                  onChange={(e) => setGuestCount(Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-lg border border-neutral-200 text-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-black font-medium"
                />
                <span className="text-xs font-medium text-neutral-700 mt-1 block">
                  Maximum capacity: {selectedRoom.max_capacity} guests
                </span>
              </div>

              <div>
                <label className="font-medium text-neutral-700 block mb-1.5">
                  Estimated Arrival Time <span className="text-neutral-600 font-normal">(Optional)</span>
                </label>
                <select
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-neutral-200 text-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-black font-medium appearance-none bg-white"
                >
                  <option value="">Not Sure Yet</option>
                  <option value="2:00 PM - 4:00 PM">2:00 PM - 4:00 PM</option>
                  <option value="4:00 PM - 6:00 PM">4:00 PM - 6:00 PM</option>
                  <option value="After 6:00 PM">Late Arrival (After 6:00 PM)</option>
                </select>
                <span className="text-xs font-medium text-neutral-700 mt-1 block">
                  Standard Check-in: 2:00 PM | Check-out: 12:00 PM
                </span>
              </div>

              {services.length > 0 && (
                <div className="pt-2 border-t border-neutral-100">
                  <label className="font-bold text-neutral-900 block mb-2">
                    Enhance your stay (Optional Add-ons)
                  </label>
                  <div className="space-y-2">
                    {services.map((service) => (
                      <label key={service.id} className="flex items-start gap-3 p-3 rounded-xl border border-neutral-200 bg-neutral-50/50 cursor-pointer hover:border-black transition-colors">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-neutral-300 text-black focus:ring-black"
                          checked={selectedAddons.includes(service.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAddons(prev => [...prev, service.id]);
                            } else {
                              setSelectedAddons(prev => prev.filter(id => id !== service.id));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-neutral-900 text-sm">{service.name}</span>
                            <span className="font-bold text-neutral-900 text-sm">₱{Number(service.price).toLocaleString()}</span>
                          </div>
                          {service.description && (
                            <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{service.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm space-y-2">
              <div className="flex justify-between text-neutral-600">
                <span className="font-medium text-neutral-700">
                  ₱{selectedRoom.base_price.toLocaleString()} &times; {calculateTotalNights()} {calculateTotalNights() === 1 ? "night" : "nights"}
                </span>
                <span className="font-bold text-neutral-900 text-base">
                  ₱{(selectedRoom.base_price * calculateTotalNights()).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between font-bold text-sm text-neutral-900 pt-1 border-t border-neutral-200">
                <span>Estimated Total</span>
                <span>
                  ₱{calculateTotalPrice(selectedRoom.base_price).toLocaleString()}
                </span>
              </div>
            </div>

            <Button
              onClick={handleCreateBooking}
              disabled={isSubmittingBooking || !!conflictingBooking || checkInDate >= checkOutDate}
              className="w-full h-12 bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed text-sm font-semibold rounded-xl transition-all"
            >
              {isSubmittingBooking ? (
                "Verifying & Sending Request..."
              ) : conflictingBooking ? (
                "Dates Unavailable (Already Booked)"
              ) : checkInDate >= checkOutDate ? (
                "Select Valid Dates"
              ) : (
                "Confirm & Send Request"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Multi-Photo Room Lightbox Modal (5+ Angles & Amenities) */}
      {gallery.isOpen && gallery.images.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md"
          onClick={() => setGallery((prev) => ({ ...prev, isOpen: false }))}
        >
          <div
            className="relative max-w-4xl w-full rounded-2xl overflow-hidden shadow-2xl bg-neutral-950 border border-white/10 flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gallery Top Bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-neutral-900 text-white shrink-0">
              <div className="flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-neutral-500" />
                <span className="font-bold text-sm truncate max-w-xs sm:max-w-md">
                  {gallery.roomName}
                </span>
                <span className="text-xs text-neutral-500 font-mono bg-white/10 px-2 py-0.5 rounded">
                  Angle {gallery.currentIndex + 1} of {gallery.images.length}
                </span>
              </div>

              <button
                onClick={() => setGallery((prev) => ({ ...prev, isOpen: false }))}
                className="p-1.5 rounded-full hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Main Active Image Stage with Left & Right Arrows */}
            <div className="relative flex-1 aspect-[16/10] sm:aspect-[16/9] w-full bg-black flex items-center justify-center overflow-hidden">
              <Image
                src={gallery.images[gallery.currentIndex]}
                alt={`${gallery.roomName} angle ${gallery.currentIndex + 1}`}
                fill
                sizes="100vw"
                className="object-contain"
              />

              {/* Prev Button */}
              {gallery.images.length > 1 && (
                <button
                  onClick={() =>
                    setGallery((prev) => ({
                      ...prev,
                      currentIndex:
                        prev.currentIndex === 0
                          ? prev.images.length - 1
                          : prev.currentIndex - 1,
                    }))
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black text-white transition-all shadow-lg border border-white/20"
                  title="Previous angle"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}

              {/* Next Button */}
              {gallery.images.length > 1 && (
                <button
                  onClick={() =>
                    setGallery((prev) => ({
                      ...prev,
                      currentIndex:
                        (prev.currentIndex + 1) % prev.images.length,
                    }))
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black text-white transition-all shadow-lg border border-white/20"
                  title="Next angle"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Bottom Thumbnail Strip for all angles */}
            <div className="p-3 bg-neutral-900 border-t border-white/10 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-hide">
              {gallery.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setGallery((prev) => ({ ...prev, currentIndex: idx }))}
                  className={`relative h-14 w-20 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                    gallery.currentIndex === idx
                      ? "border-white scale-105 shadow-md"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <Image src={img} alt={`Angle ${idx + 1}`} fill sizes="100px" className="object-cover" />
                  <span className="absolute bottom-0.5 right-1 text-[9px] font-mono text-white bg-black/70 px-1 rounded">
                    #{idx + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Auth Gate Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setPendingRoomToBook(null);
        }}
        redirectOnSuccess={false}
        onLoginSuccess={async () => {
          const supabase = createClient();
          const { data } = await supabase.auth.getUser();
          setUser(data.user);
          setIsAuthModalOpen(false);
          if (pendingRoomToBook) {
            setSelectedRoom(pendingRoomToBook);
            setPendingRoomToBook(null);
          }
        }}
      />
    </div>
  );
}
