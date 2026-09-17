"use client";

import * as React from "react";
import {
  SlidersHorizontal,
  X,
  RotateCcw,
  Check,
  Plus,
  Minus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterState {
  propertyType: "all" | "homestay" | "resort";
  minPrice: number;
  maxPrice: number;
  minGuests: number;
  sortBy: "recommended" | "price_asc" | "price_desc" | "rating";
  amenities: string[];
}

export const INITIAL_FILTERS: FilterState = {
  propertyType: "all",
  minPrice: 0,
  maxPrice: 10000,
  minGuests: 1,
  sortBy: "recommended",
  amenities: [],
};

export const AVAILABLE_AMENITIES = [
  "Beachfront",
  "Air Conditioning",
  "Free WiFi",
  "Free Breakfast",
  "Boat Transfer / Island Tour",
  "Swimming Pool",
  "Kitchen Access",
  "Pet Friendly",
];

export interface FilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onApplyFilters: (newFilters: FilterState) => void;
  onResetFilters: () => void;
  totalResultsCount?: number;
}

export function FilterDialog({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters,
  totalResultsCount,
}: FilterDialogProps) {
  const [draft, setDraft] = React.useState<FilterState>(filters);
  const [prevIsOpen, setPrevIsOpen] = React.useState(isOpen);

  // Sync draft whenever dialog opens
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setDraft(filters);
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  // We remove early return to allow AnimatePresence to handle exit animation.

  const toggleAmenity = (amenity: string) => {
    setDraft((prev) => {
      const exists = prev.amenities.includes(amenity);
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter((a) => a !== amenity)
          : [...prev.amenities, amenity],
      };
    });
  };

  const handleApply = () => {
    onApplyFilters(draft);
    onClose();
  };

  const handleReset = () => {
    setDraft(INITIAL_FILTERS);
    onResetFilters();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="filter-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg rounded-2xl bg-white border border-neutral-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-neutral-800" />
            <h2
              id="filter-dialog-title"
              className="text-base font-semibold text-neutral-900"
            >
              Filter Stays
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 px-2 py-1 rounded-md transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
            <button
              onClick={onClose}
              aria-label="Close filters"
              className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Property Type */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
              Property Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "all", label: "All Stays" },
                { id: "homestay", label: "Homestay" },
                { id: "resort", label: "Resort" },
              ].map((type) => {
                const isSelected = draft.propertyType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        propertyType: type.id as FilterState["propertyType"],
                      }))
                    }
                    className={cn(
                      "flex items-center justify-center py-2.5 px-3 rounded-xl border text-xs font-medium transition-all select-none",
                      isSelected
                        ? "border-black bg-black text-white shadow-xs"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                    )}
                  >
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort By */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
              Sort By
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "recommended", label: "Recommended" },
                { id: "rating", label: "Highest Rated" },
                { id: "price_asc", label: "Price: Low to High" },
                { id: "price_desc", label: "Price: High to Low" },
              ].map((sortOption) => {
                const isSelected = draft.sortBy === sortOption.id;
                return (
                  <button
                    key={sortOption.id}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        sortBy: sortOption.id as FilterState["sortBy"],
                      }))
                    }
                    className={cn(
                      "flex items-center justify-between py-2 px-3 rounded-lg border text-xs font-medium transition-all select-none text-left",
                      isSelected
                        ? "border-black bg-neutral-100 text-black font-semibold"
                        : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
                    )}
                  >
                    <span>{sortOption.label}</span>
                    {isSelected && <Check className="h-3 w-3 text-black" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Guest Count Stepper */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
              Minimum Guests
            </label>
            <div className="flex items-center justify-between rounded-xl border border-neutral-200 p-3 bg-neutral-50/50">
              <div>
                <p className="text-sm font-medium text-neutral-800">
                  {draft.minGuests} {draft.minGuests === 1 ? "Guest" : "Guests"}
                </p>
                <p className="text-xs text-neutral-600">
                  For couples, families, or tour groups
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={draft.minGuests <= 1}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      minGuests: Math.max(1, prev.minGuests - 1),
                    }))
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 disabled:opacity-40 disabled:pointer-events-none hover:bg-neutral-100"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-semibold">
                  {draft.minGuests}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      minGuests: prev.minGuests + 1,
                    }))
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Price Range */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
              Price Range (PHP / Night)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-neutral-600">Min Price</span>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
                    ₱
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={draft.minPrice}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        minPrice: Number(e.target.value),
                      }))
                    }
                    className="w-full h-10 pl-7 pr-3 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-900 focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>

              <div>
                <span className="text-[11px] text-neutral-600">Max Price</span>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
                    ₱
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={draft.maxPrice}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        maxPrice: Number(e.target.value),
                      }))
                    }
                    className="w-full h-10 pl-7 pr-3 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-900 focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Amenities Checklist */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
              Amenities & Features
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AVAILABLE_AMENITIES.map((amenity) => {
                const isChecked = draft.amenities.includes(amenity);
                return (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => toggleAmenity(amenity)}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-lg border text-xs text-left transition-all",
                      isChecked
                        ? "border-black bg-neutral-50 text-neutral-900 font-medium"
                        : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                        isChecked
                          ? "border-black bg-black text-white"
                          : "border-neutral-300 bg-white"
                      )}
                    >
                      {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <span>{amenity}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-neutral-100 bg-neutral-50/50">
          <p className="text-xs text-neutral-600">
            {totalResultsCount !== undefined && (
              <span>{totalResultsCount} stays match current filters</span>
            )}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs border-neutral-200"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              className="bg-black text-white hover:bg-neutral-800 text-xs px-5"
            >
              Show Results
            </Button>
          </div>
        </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}
