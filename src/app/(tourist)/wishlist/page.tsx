"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Heart,
  MapPin,
  Building2,
  Home,
  Users,
  ArrowLeft,
  Trash2,
  Sparkles,
  ShieldCheck,
  Compass,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useWishlist } from "@/hooks/use-wishlist";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { formatCurrency } from "@/lib/utils";

interface WishlistProperty {
  id: string;
  name: string;
  type: "homestay" | "resort";
  description: string;
  address: string;
  cover_image_url: string;
  status: string;
  owner_id: string;
  owner_name: string;
  min_price: number;
  max_capacity: number;
  room_count: number;
}

export default function WishlistPage() {
  const { savedIds, isLoaded: isWishlistLoaded, removeSave } = useWishlist();
  const [properties, setProperties] = React.useState<WishlistProperty[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedFilter, setSelectedFilter] = React.useState<"all" | "resort" | "homestay">("all");

  const fetchWishlistProperties = React.useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setProperties([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();

      // Fetch properties along with their rooms
      const { data: dbProps, error } = await supabase
        .from("properties")
        .select(`
          id,
          name,
          type,
          description,
          address,
          cover_image_url,
          status,
          owner_id,
          rooms (
            id,
            base_price,
            max_capacity
          )
        `)
        .in("id", ids);

      if (error) {
        console.error("Error fetching wishlist properties:", error);
        setProperties([]);
        setIsLoading(false);
        return;
      }

      // Fetch owner profile names
      const ownerIds = Array.from(new Set((dbProps || []).map((p: any) => p.owner_id).filter(Boolean)));
      let ownerMap: Record<string, string> = {};

      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .in("id", ownerIds);

        if (profiles) {
          profiles.forEach((pr: any) => {
            ownerMap[pr.id] = pr.full_name;
          });
        }
      }

      const mapped: WishlistProperty[] = (dbProps || []).map((p: any) => {
        const roomPrices = (p.rooms || []).map((r: any) => Number(r.base_price) || 0);
        const minPrice = roomPrices.length > 0 ? Math.min(...roomPrices) : 1500;
        const maxCap = Math.max(
          ...(p.rooms || []).map((r: any) => Number(r.max_capacity) || 2),
          2
        );

        return {
          id: p.id,
          name: p.name,
          type: p.type as "homestay" | "resort",
          description: p.description || "",
          address: p.address || "Bretania, San Agustin, Surigao del Sur",
          cover_image_url:
            p.cover_image_url ||
            "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80",
          status: p.status,
          owner_id: p.owner_id,
          owner_name: ownerMap[p.owner_id] || (p.type === "resort" ? "Resort Operator" : "Homestay Host"),
          min_price: minPrice,
          max_capacity: maxCap,
          room_count: p.rooms?.length || 0,
        };
      });

      setProperties(mapped);
    } catch (err) {
      console.error("Wishlist loading failed:", err);
      setProperties([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isWishlistLoaded) {
      fetchWishlistProperties(savedIds);
    }
  }, [isWishlistLoaded, savedIds, fetchWishlistProperties]);

  const filteredProperties = React.useMemo(() => {
    if (selectedFilter === "all") return properties;
    return properties.filter((p) => p.type === selectedFilter);
  }, [properties, selectedFilter]);

  const resortsCount = properties.filter((p) => p.type === "resort").length;
  const homestaysCount = properties.filter((p) => p.type === "homestay").length;

  return (
    <div className="min-h-screen bg-neutral-50/50 pb-24 md:pb-12">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-black transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Profile</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Logo size="small" />
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Wishlist
            </span>
          </div>

          <Link
            href="/"
            className="text-xs font-semibold text-neutral-900 hover:underline"
          >
            Explore Stays
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
        {/* Title Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-red-50 text-red-500">
                <Heart className="h-5 w-5 fill-red-500 text-red-500" />
              </span>
              <h1 className="text-2xl font-black text-neutral-900 tracking-tight">
                My Saved Stays
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-neutral-600">
              Resorts and homestays you&apos;ve shortlisted in Bretania, San Agustin.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="subtle" size="sm" className="bg-neutral-100 text-neutral-800 text-xs px-3 py-1.5 font-bold">
              {properties.length} {properties.length === 1 ? "Stay" : "Stays"} Saved
            </Badge>
          </div>
        </div>

        {/* Filter Tabs */}
        {properties.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedFilter("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedFilter === "all"
                  ? "bg-black text-white shadow-sm"
                  : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              All Stays ({properties.length})
            </button>
            <button
              onClick={() => setSelectedFilter("resort")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedFilter === "resort"
                  ? "bg-black text-white shadow-sm"
                  : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Resorts ({resortsCount})</span>
            </button>
            <button
              onClick={() => setSelectedFilter("homestay")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedFilter === "homestay"
                  ? "bg-black text-white shadow-sm"
                  : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              <Home className="h-3.5 w-3.5" />
              <span>Homestays ({homestaysCount})</span>
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white border border-neutral-200 rounded-2xl">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-500 mb-3" />
            <p className="text-sm font-medium text-neutral-600">Loading your saved stays...</p>
          </div>
        ) : filteredProperties.length > 0 ? (
          /* Wishlist Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProperties.map((property) => {
              const isResort = property.type === "resort";

              return (
                <div
                  key={property.id}
                  className="group relative flex flex-col rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-neutral-300 transition-all"
                >
                  {/* Property Cover Image */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100">
                    <img
                      src={property.cover_image_url}
                      alt={property.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Type Badge */}
                    <div className="absolute top-3 left-3">
                      <Badge
                        variant="subtle"
                        size="sm"
                        className={`font-bold uppercase tracking-wider text-[10px] px-2.5 py-1 backdrop-blur-md shadow-sm ${
                          isResort
                            ? "bg-black text-white border-none"
                            : "bg-emerald-600 text-white border-none"
                        }`}
                      >
                        {isResort ? (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> Resort
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Home className="h-3 w-3" /> Homestay
                          </span>
                        )}
                      </Badge>
                    </div>

                    {/* Un-heart Button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeSave(property.id, property.name);
                      }}
                      title="Remove from wishlist"
                      aria-label="Remove from wishlist"
                      className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-red-500 hover:bg-white hover:scale-110 shadow-sm transition-all"
                    >
                      <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                    </button>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-base text-neutral-900 group-hover:text-black line-clamp-1">
                          {property.name}
                        </h3>
                      </div>

                      {/* Owner / Host Information */}
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600 font-medium">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">
                          Hosted by <strong className="text-neutral-800">{property.owner_name}</strong>
                        </span>
                      </div>

                      {/* Location */}
                      <div className="flex items-center gap-1 text-xs text-neutral-600">
                        <MapPin className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                        <span className="truncate">{property.address}</span>
                      </div>
                    </div>

                    {/* Price and Action Footer */}
                    <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-neutral-500 block tracking-wider">
                          Starts at
                        </span>
                        <div className="text-sm font-black text-neutral-900">
                          {formatCurrency(property.min_price)}
                          <span className="text-[11px] font-normal text-neutral-600"> / night</span>
                        </div>
                      </div>

                      <Link
                        href={`/property/${property.id}`}
                        className="px-3.5 py-2 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition-all flex items-center gap-1 shrink-0"
                      >
                        <span>View Stay</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-white border border-neutral-200 rounded-2xl shadow-sm space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
              <Heart className="h-8 w-8 text-red-400" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-lg font-bold text-neutral-900">
                {selectedFilter === "all"
                  ? "Your Wishlist is Empty"
                  : `No ${selectedFilter === "resort" ? "Resorts" : "Homestays"} in Wishlist`}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600">
                Explore Bretania&apos;s verified beach resorts and cozy local homestays, then tap the heart icon to save your favorites here.
              </p>
            </div>
            <Link
              href="/"
              className="px-6 py-3 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition-all flex items-center gap-2 mt-2"
            >
              <Compass className="h-4 w-4" />
              <span>Explore Stays in Bretania</span>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
