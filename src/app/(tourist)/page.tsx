"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Compass,
  SlidersHorizontal,
  Search,
  Sparkles,
  RefreshCw,
  X,
  ArrowUpDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TouristHeader,
} from "@/components/tourist/tourist-header";
import {
  CategoryFilterBar,
  DEFAULT_TOURIST_CATEGORIES,
} from "@/components/tourist/category-filter-bar";
import {
  PropertyCard,
  type PropertyCardData,
} from "@/components/tourist/property-card";
import { LoadingLogo } from "@/components/shared/loading-logo";
import {
  FilterDialog,
  INITIAL_FILTERS,
  type FilterState,
} from "@/components/tourist/filter-dialog";
import { EmptyState } from "@/components/tourist/empty-state";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/hooks/use-wishlist";
import { useRouter } from "next/navigation";
import { ROLE_HOME_ROUTES, type UserRole } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";

export default function TouristDiscoveryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [viewMode, setViewMode] = React.useState<"grid" | "feed">("grid");
  const [isFilterDialogOpen, setIsFilterDialogOpen] = React.useState(false);
  const [filters, setFilters] = React.useState<FilterState>(INITIAL_FILTERS);

  // Default to feed view on mobile devices for better UX
  React.useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setViewMode("feed");
    }
  }, []);
  const { user: authUser, profile, isLoading: authLoading } = useAuth();
  const { savedSet, toggleSave, count: savedCount } = useWishlist();

  const user = React.useMemo(() => {
    if (!authUser) return null;
    return {
      email: authUser.email,
      fullName: profile?.full_name || authUser.email?.split("@")[0],
      role: profile?.role || "tourist",
    };
  }, [authUser, profile]);

  React.useEffect(() => {
    if (user?.role && user.role !== "tourist" && ROLE_HOME_ROUTES[user.role as UserRole]) {
      router.replace(ROLE_HOME_ROUTES[user.role as UserRole]);
    }
  }, [user, router]);

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const supabase = createClient();
      const { data: dbProperties, error } = await supabase
        .from("properties")
        .select(`
          id,
          name,
          type,
          description,
          address,
          cover_image_url,
          status,
          rooms (
            base_price,
            max_capacity
          )
        `)
        .eq("status", "active");

      if (error) {
        toast.error("Failed to load properties.");
        return [];
      } else {
        // Map database records into UI PropertyCardData
        const mapped: PropertyCardData[] = (dbProperties || []).map((p: any) => {
          const roomPrices = (p.rooms || []).map((r: any) => Number(r.base_price) || 0);
          const minPrice = roomPrices.length > 0 ? Math.min(...roomPrices) : 0;
          const maxCap = Math.max(...(p.rooms || []).map((r: any) => Number(r.max_capacity) || 2), 2);

          return {
            id: p.id,
            name: p.name,
            type: p.type as "homestay" | "resort",
            address: p.address || "Bretania, San Agustin, Surigao del Sur",
            cover_image_url: p.cover_image_url,
            base_price: minPrice,
            rating: p.rating,
            reviews_count: p.reviews_count,
            max_capacity: maxCap,
            is_verified: true,
            status: p.status,
            amenities: [],
          };
        });
        return mapped;
      }
    },
  });

  const fetchData = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["properties"] });
  }, [queryClient]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle favorite toggles with feedback
  const handleToggleFavorite = (propertyId: string, _current: boolean) => {
    const prop = properties.find((p) => p.id === propertyId);
    toggleSave(propertyId, prop?.name);
  };

  // Filter & Search pipeline
  const filteredProperties = React.useMemo(() => {
    let list = properties.map((p) => ({
      ...p,
      is_favorited: savedSet.has(p.id),
    }));

    // 1. Text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q) ||
          p.type.toLowerCase().includes(q)
      );
    }

    // 2. Category Tab Filter
    if (selectedCategory !== "all") {
      if (selectedCategory === "homestay" || selectedCategory === "resort") {
        list = list.filter((p) => p.type === selectedCategory);
      } else if (selectedCategory === "budget") {
        list = list.filter((p) => p.base_price <= 1500);
      } else {
        list = list.filter((p) =>
          p.amenities?.some((a) =>
            a.toLowerCase().includes(selectedCategory.replace("_", " "))
          )
        );
      }
    }

    // 3. Modal Filters
    if (filters.propertyType !== "all") {
      list = list.filter((p) => p.type === filters.propertyType);
    }

    list = list.filter(
      (p) => p.base_price >= filters.minPrice && p.base_price <= filters.maxPrice
    );

    if (filters.minGuests > 1) {
      list = list.filter((p) => (p.max_capacity || 2) >= filters.minGuests);
    }

    if (filters.amenities.length > 0) {
      list = list.filter((p) =>
        filters.amenities.every((amenity) =>
          p.amenities?.some((a) =>
            a.toLowerCase().includes(amenity.toLowerCase())
          )
        )
      );
    }

    // 4. Sorting
    list = [...list].sort((a, b) => {
      if (filters.sortBy === "price_asc") {
        return a.base_price - b.base_price;
      }
      if (filters.sortBy === "price_desc") {
        return b.base_price - a.base_price;
      }
      if (filters.sortBy === "rating") {
        return (b.rating || 0) - (a.rating || 0);
      }
      // default: recommended (highest rating + review weight)
      return (b.rating || 0) - (a.rating || 0);
    });

    return list;
  }, [properties, searchQuery, selectedCategory, filters, savedSet]);

  // Calculate active filter count for badge
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (filters.propertyType !== "all") count++;
    if (filters.minPrice > 0 || filters.maxPrice < 10000) count++;
    if (filters.minGuests > 1) count++;
    if (filters.sortBy !== "recommended") count++;
    if (filters.amenities.length > 0) count += filters.amenities.length;
    return count;
  }, [filters]);

  // Dynamic Category Counts (Single-pass O(N) linear time)
  const categoriesWithCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      all: properties.length,
      homestay: 0,
      resort: 0,
      budget: 0,
    };

    DEFAULT_TOURIST_CATEGORIES.forEach((c) => {
      if (!(c.id in counts)) counts[c.id] = 0;
    });

    for (let i = 0; i < properties.length; i++) {
      const p = properties[i];
      if (p.type === "homestay") counts.homestay++;
      if (p.type === "resort") counts.resort++;
      if (p.base_price <= 1500) counts.budget++;

      if (p.amenities && p.amenities.length > 0) {
        for (let j = 0; j < p.amenities.length; j++) {
          const am = p.amenities[j].toLowerCase();
          for (let k = 0; k < DEFAULT_TOURIST_CATEGORIES.length; k++) {
            const catId = DEFAULT_TOURIST_CATEGORIES[k].id;
            if (catId !== "all" && catId !== "homestay" && catId !== "resort" && catId !== "budget") {
              if (am.includes(catId.replace("_", " "))) {
                counts[catId]++;
              }
            }
          }
        }
      }
    }

    return DEFAULT_TOURIST_CATEGORIES.map((cat) => ({
      ...cat,
      count: counts[cat.id] || 0,
    }));
  }, [properties]);

  const handleResetAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setFilters(INITIAL_FILTERS);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 1. Header with Global Search, View Mode Toggle, and Navigation */}
      <TouristHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeFiltersCount={activeFiltersCount}
        onOpenFilters={() => setIsFilterDialogOpen(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        user={user}
        isLoading={authLoading}
        savedCount={savedCount}
        onLoginSuccess={fetchData}
      />

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        {/* 2. Category Filter Pill Bar */}
        <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-3">
          <CategoryFilterBar
            categories={categoriesWithCounts}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            className="flex-1"
          />

          {/* Refresh / Sync Button */}
          <button
            onClick={fetchData}
            title="Refresh stays from Supabase"
            aria-label="Refresh stays"
            disabled={isLoading}
            className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-black p-2 rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </button>
        </div>

        {/* 3. Active Filters Chips / Summary */}
        {(activeFiltersCount > 0 || searchQuery || selectedCategory !== "all") && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-neutral-500 font-medium">
              Active filters:
            </span>

            {searchQuery && (
              <Badge
                variant="outline"
                className="gap-1 bg-neutral-50 text-neutral-800"
              >
                Search: &quot;{searchQuery}&quot;
                <button
                  onClick={() => setSearchQuery("")}
                  className="hover:text-red-600"
                  aria-label="Remove search filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            {selectedCategory !== "all" && (
              <Badge
                variant="outline"
                className="gap-1 bg-neutral-50 text-neutral-800 capitalize"
              >
                Category: {selectedCategory.replace("_", " ")}
                <button
                  onClick={() => setSelectedCategory("all")}
                  className="hover:text-red-600"
                  aria-label="Remove category filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            {filters.propertyType !== "all" && (
              <Badge
                variant="outline"
                className="gap-1 bg-neutral-50 text-neutral-800 capitalize"
              >
                Type: {filters.propertyType}
                <button
                  onClick={() =>
                    setFilters((f) => ({ ...f, propertyType: "all" }))
                  }
                  className="hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            {filters.minGuests > 1 && (
              <Badge
                variant="outline"
                className="gap-1 bg-neutral-50 text-neutral-800"
              >
                Min {filters.minGuests} guests
                <button
                  onClick={() => setFilters((f) => ({ ...f, minGuests: 1 }))}
                  className="hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            {(filters.minPrice > 0 || filters.maxPrice < 10000) && (
              <Badge
                variant="outline"
                className="gap-1 bg-neutral-50 text-neutral-800"
              >
                ₱{filters.minPrice} - ₱{filters.maxPrice}
                <button
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      minPrice: 0,
                      maxPrice: 10000,
                    }))
                  }
                  className="hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            <Button
              variant="ghost"
              size="xs"
              onClick={handleResetAllFilters}
              className="text-xs text-neutral-600 hover:text-black hover:bg-neutral-100 h-6 px-2"
            >
              Clear all
            </Button>
          </div>
        )}

        {/* 4. Results Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
              Stays in Bretania Islands
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 mt-0.5">
              Accredited by the San Agustin Resort & Homestay Association (MVBA)
            </p>
          </div>

          <div className="text-xs font-semibold text-neutral-600">
            {!isLoading && (
              <span>
                {filteredProperties.length}{" "}
                {filteredProperties.length === 1 ? "stay" : "stays"} available
              </span>
            )}
          </div>
        </div>

        {/* 5. Listing Content: Loading State, Empty State, or Results */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <LoadingLogo size="large" />
            <p className="mt-6 text-sm font-semibold tracking-wider uppercase text-neutral-400 animate-pulse">Loading available stays</p>
          </div>
        ) : filteredProperties.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="No matching stays found"
            description="We couldn't find any properties matching your current search criteria. Try adjusting your filters or search terms."
            actionLabel="Reset All Filters"
            onAction={handleResetAllFilters}
            secondaryActionLabel="Refresh Data"
            onSecondaryAction={fetchData}
          />
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
                : "flex flex-col gap-6 max-w-2xl mx-auto"
            }
          >
            {filteredProperties.map((property, idx) => (
              <PropertyCard
                key={property.id}
                property={property}
                viewMode={viewMode}
                priority={idx < 3}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        )}

      </main>

      {/* 7. Modal Filter Dialog */}
      <FilterDialog
        isOpen={isFilterDialogOpen}
        onClose={() => setIsFilterDialogOpen(false)}
        filters={filters}
        onApplyFilters={setFilters}
        onResetFilters={() => setFilters(INITIAL_FILTERS)}
        totalResultsCount={filteredProperties.length}
      />
    </div>
  );
}
