"use client";

import * as React from "react";
import {
  Sparkles,
  Home,
  Building2,
  Waves,
  Ship,
  Wallet,
  Dog,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CategoryOption {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

export const DEFAULT_TOURIST_CATEGORIES: CategoryOption[] = [
  { id: "all", label: "All Stays", icon: Sparkles },
  { id: "homestay", label: "Homestays", icon: Home },
  { id: "resort", label: "Resorts", icon: Building2 },
  { id: "beachfront", label: "Beachfront", icon: Waves },
  { id: "island_hopping", label: "Island Hopping", icon: Ship },
  { id: "budget", label: "Under ₱1,500", icon: Wallet },
  { id: "pet_friendly", label: "Pet Friendly", icon: Dog },
];

export interface CategoryFilterBarProps {
  categories?: CategoryOption[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  className?: string;
}

export function CategoryFilterBar({
  categories = DEFAULT_TOURIST_CATEGORIES,
  selectedCategory,
  onSelectCategory,
  className,
}: CategoryFilterBarProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Keyboard navigation for accessible tablist
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = (index + 1) % categories.length;
      onSelectCategory(categories[nextIndex].id);
      const nextBtn = containerRef.current?.querySelectorAll("button")[nextIndex];
      nextBtn?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = (index - 1 + categories.length) % categories.length;
      onSelectCategory(categories[prevIndex].id);
      const prevBtn = containerRef.current?.querySelectorAll("button")[prevIndex];
      prevBtn?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      onSelectCategory(categories[0].id);
      const firstBtn = containerRef.current?.querySelectorAll("button")[0];
      firstBtn?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      const lastIndex = categories.length - 1;
      onSelectCategory(categories[lastIndex].id);
      const lastBtn = containerRef.current?.querySelectorAll("button")[lastIndex];
      lastBtn?.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Filter stays by category"
      className={cn(
        "flex items-center gap-2 overflow-x-auto py-1 scrollbar-hide focus:outline-none",
        className
      )}
    >
      {categories.map((category, index) => {
        const Icon = category.icon;
        const isSelected = selectedCategory === category.id;

        return (
          <button
            key={category.id}
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelectCategory(category.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "relative flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 select-none border",
              isSelected
                ? "border-transparent bg-black text-white shadow-sm"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 active:bg-neutral-50"
            )}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5 stroke-[2] relative z-10",
                isSelected ? "text-white" : "text-neutral-600"
              )}
              aria-hidden="true"
            />
            <span className="relative z-10">{category.label}</span>
            {category.count !== undefined && (
              <span
                className={cn(
                  "ml-0.5 rounded-full px-1.5 py-0.2 text-[10px]",
                  isSelected
                    ? "bg-neutral-800 text-neutral-200"
                    : "bg-neutral-100 text-neutral-600"
                )}
              >
                {category.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
