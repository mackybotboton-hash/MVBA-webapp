"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Heart,
  MapPin,
  Star,
  ShieldCheck,
  Users,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PropertyCardData {
  id: string;
  name: string;
  type: "homestay" | "resort";
  address: string;
  cover_image_url?: string;
  base_price: number;
  rating?: number;
  reviews_count?: number;
  max_capacity?: number;
  is_verified?: boolean;
  is_favorited?: boolean;
  amenities?: string[];
  status?: "active" | "renovating" | "full" | "closed";
}

export interface PropertyCardProps {
  property: PropertyCardData;
  viewMode?: "grid" | "feed";
  onToggleFavorite?: (propertyId: string, current: boolean) => void;
  className?: string;
  priority?: boolean;
}

export function PropertyCard({
  property,
  viewMode = "grid",
  onToggleFavorite,
  className,
  priority = false,
}: PropertyCardProps) {
  const [imageError, setImageError] = React.useState(false);
  const [isFavorited, setIsFavorited] = React.useState(
    Boolean(property.is_favorited)
  );

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextState = !isFavorited;
    setIsFavorited(nextState);
    onToggleFavorite?.(property.id, nextState);
  };

  const formattedPrice = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(property.base_price || 0);

  // Fallback visual for property cover
  const imageSrc =
    !imageError && property.cover_image_url
      ? property.cover_image_url
      : null;

  if (viewMode === "feed") {
    return (
      <motion.article
        whileHover={{ scale: 0.98 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className={cn(
          "group relative flex flex-col rounded-3xl border border-neutral-100 bg-white overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300",
          className
        )}
      >
        {/* Visual Hero Area */}
        <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full bg-neutral-100 overflow-hidden">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={property.name}
              fill
              priority={priority}
              sizes="(max-width: 768px) 100vw, 672px"
              className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 text-neutral-500 p-6">
              <span className="text-3xl font-bold tracking-tight text-neutral-300">
                {property.name.slice(0, 2).toUpperCase()}
              </span>
              <p className="mt-2 text-xs font-medium text-neutral-600">
                Bretania Islands, San Agustin
              </p>
            </div>
          )}

          {/* Badges on Hero */}
          <div className="absolute top-3.5 left-3.5 flex flex-wrap items-center gap-1.5 z-10">
            <Badge
              variant={property.type === "resort" ? "default" : "secondary"}
              className="capitalize shadow-xs backdrop-blur-md"
            >
              {property.type}
            </Badge>

            {property.is_verified !== false && (
              <Badge
                variant="subtle"
                className="bg-white/95 text-neutral-800 backdrop-blur-md border-neutral-200/80 shadow-xs"
              >
                <ShieldCheck className="h-3 w-3 text-emerald-600 mr-0.5" />
                Verified
              </Badge>
            )}
          </div>

          {/* Favorite Toggle Button */}
          <button
            type="button"
            aria-label={isFavorited ? "Remove from saved" : "Save property"}
            aria-pressed={isFavorited}
            onClick={handleFavoriteClick}
            className="absolute top-3.5 right-3.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur-md text-neutral-700 shadow-sm transition-transform active:scale-90 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-colors",
                isFavorited
                  ? "fill-red-500 text-red-500"
                  : "text-neutral-700 group-hover:text-black"
              )}
            />
          </button>
        </div>

        {/* Content Details */}
        <div className="p-4 sm:p-5 flex flex-col justify-between flex-1 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold text-neutral-900 tracking-tight leading-snug">
                <Link
                  href={`/property/${property.id}`}
                  className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-sm"
                >
                  {property.name}
                </Link>
              </h3>

              <div className="flex items-center gap-1 text-sm font-semibold text-neutral-900 shrink-0">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span>{!property.reviews_count ? "New" : property.rating ? property.rating.toFixed(1) : "0.0"}</span>
                {!!property.reviews_count && (
                  <span className="text-xs text-neutral-600 font-medium">
                    ({property.reviews_count})
                  </span>
                )}
              </div>
            </div>

            <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-700">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-neutral-700" />
              <span className="truncate">
                {property.address || "Bretania Islands, San Agustin"}
              </span>
            </p>
          </div>

          {/* Footer with Price and CTA */}
          <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-neutral-900">
                  {formattedPrice}
                </span>
                <span className="text-xs text-neutral-600 font-medium">
                  / night
                </span>
              </div>
              {property.max_capacity && (
                <p className="text-[11px] font-medium text-neutral-600 flex items-center gap-1 mt-0.5">
                  <Users className="h-3 w-3 text-neutral-600" /> Up to {property.max_capacity} guests
                </p>
              )}
            </div>

            <Link href={`/property/${property.id}`}>
              <Button
                size="sm"
                className="bg-black text-white hover:bg-neutral-800 font-medium text-xs h-9 px-4 rounded-lg"
              >
                View Rooms
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.article>
    );
  }

  // Grid Mode (Marketplace style)
  return (
    <motion.article
      whileHover={{ scale: 0.98 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className={cn(
        "group flex flex-col rounded-2xl border border-neutral-100 bg-white overflow-hidden shadow-xs hover:border-neutral-200 hover:shadow-md transition-shadow duration-300",
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] w-full bg-neutral-100 overflow-hidden">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={property.name}
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-neutral-100 text-neutral-500 p-4">
            <span className="text-2xl font-bold tracking-tight text-neutral-300">
              {property.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="mt-1 text-[10px] text-neutral-500 font-medium">
              Bretania, San Agustin
            </span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 z-10">
          <Badge
            variant={property.type === "resort" ? "default" : "secondary"}
            size="sm"
            className="capitalize shadow-xs backdrop-blur-md"
          >
            {property.type}
          </Badge>
        </div>

        {/* Favorite Button */}
        <button
          type="button"
          aria-label={isFavorited ? "Remove from saved" : "Save property"}
          aria-pressed={isFavorited}
          onClick={handleFavoriteClick}
          className="absolute top-2.5 right-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur-md text-neutral-700 shadow-sm transition-transform active:scale-90 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
        >
          <Heart
            className={cn(
              "h-3.5 w-3.5 transition-colors",
              isFavorited
                ? "fill-red-500 text-red-500"
                : "text-neutral-700 group-hover:text-black"
            )}
          />
        </button>
      </div>

      {/* Info */}
      <div className="p-3.5 flex flex-col justify-between flex-1 gap-2.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-1">
            <h3 className="text-base font-semibold text-neutral-900 tracking-tight truncate leading-tight">
              <Link
                href={`/property/${property.id}`}
                className="hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black rounded-xs"
              >
                {property.name}
              </Link>
            </h3>

            <div className="flex items-center gap-0.5 text-sm font-semibold text-neutral-900 shrink-0">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span>{!property.reviews_count ? "New" : property.rating ? property.rating.toFixed(1) : "0.0"}</span>
              {!!property.reviews_count && (
                <span className="text-[10px] text-neutral-600 font-medium ml-0.5">
                  ({property.reviews_count})
                </span>
              )}
            </div>
          </div>

          <p className="flex items-center gap-1 text-xs text-neutral-600 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
            <span className="truncate">
              {property.address || "Bretania Islands, San Agustin"}
            </span>
          </p>
        </div>

        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
          <div className="flex items-baseline gap-0.5">
            <span className="text-base font-bold text-neutral-900">
              {formattedPrice}
            </span>
            <span className="text-xs text-neutral-600">/ night</span>
          </div>

          <Link
            href={`/property/${property.id}`}
            className="text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors flex items-center gap-0.5"
          >
            Details
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
