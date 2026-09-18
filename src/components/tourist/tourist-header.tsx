"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  MapPin,
  LayoutGrid,
  SquareKanban,
  X,
  User,
  Heart,
  Compass,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AuthModal } from "@/components/auth/auth-modal";

export interface TouristHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFiltersCount?: number;
  onOpenFilters?: () => void;
  viewMode?: "grid" | "feed";
  onViewModeChange?: (mode: "grid" | "feed") => void;
  user?: {
    email?: string;
    fullName?: string;
    role?: string;
  } | null;
  savedCount?: number;
  onLoginSuccess?: () => void;
}

export function TouristHeader({
  searchQuery,
  onSearchChange,
  activeFiltersCount = 0,
  onOpenFilters,
  viewMode = "grid",
  onViewModeChange,
  user,
  savedCount = 0,
  onLoginSuccess,
}: TouristHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);

  // Global hotkey '/' to focus search input
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // State for user menu dropdown
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  async function handleSignOut() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    
    setIsUserMenuOpen(false);

    // If we're on the homepage, just update the state instantly
    if (onLoginSuccess) {
      onLoginSuccess();
    }
    
    // Redirect to home if on a protected route
    if (pathname !== "/" && pathname !== "/explore") {
      router.push("/");
    }
  }

  const roleLabel =
    user?.role === "resort"
      ? "Resort Operator"
      : user?.role === "homestay"
      ? "Homestay Host"
      : user?.role === "admin"
      ? "MVBA Admin"
      : "Tourist Guest";


  const dashboardRoute =
    user?.role === "resort"
      ? "/resort"
      : user?.role === "homestay"
      ? "/homestay"
      : user?.role === "admin"
      ? "/admin"
      : null;

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-neutral-200/30 transition-all duration-300">
      {/* Top Bar: Brand & Context */}
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Logo size="small" />

          {/* Location context badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-xs font-medium text-neutral-700">
            <MapPin className="h-3.5 w-3.5 text-neutral-600" />
            <span>Bretania, San Agustin</span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link
            href="/"
            className={cn(
              "transition-colors",
              pathname === "/"
                ? "text-black font-semibold"
                : "text-neutral-600 hover:text-black"
            )}
          >
            Discover
          </Link>
          <Link
            href="/explore"
            className={cn(
              "transition-colors",
              pathname === "/explore"
                ? "text-black font-semibold"
                : "text-neutral-600 hover:text-black"
            )}
          >
            Explore Bretania
          </Link>
          <Link
            href="/bookings"
            className={cn(
              "transition-colors",
              pathname.startsWith("/bookings")
                ? "text-black font-semibold"
                : "text-neutral-600 hover:text-black"
            )}
          >
            My Bookings
          </Link>
          <Link
            href="/chat"
            className={cn(
              "transition-colors",
              pathname.startsWith("/chat")
                ? "text-black font-semibold"
                : "text-neutral-600 hover:text-black"
            )}
          >
            Messages
          </Link>
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          {/* View Mode Switcher (only on main discover page) */}
          {onViewModeChange && (
            <div className="flex items-center rounded-lg border border-neutral-200 p-0.5 bg-neutral-50">
              <button
                type="button"
                onClick={() => onViewModeChange("grid")}
                aria-label="Grid view"
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === "grid"
                    ? "bg-white text-black shadow-xs font-semibold"
                    : "text-neutral-500 hover:text-neutral-700"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("feed")}
                aria-label="Feed view"
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === "feed"
                    ? "bg-white text-black shadow-xs font-semibold"
                    : "text-neutral-500 hover:text-neutral-700"
                )}
              >
                <SquareKanban className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Wishlist Link & Live Badge */}
          <Link
            href="/wishlist"
            title="My Saved Stays"
            className="relative p-2 rounded-full border border-neutral-200 text-neutral-700 hover:text-black hover:bg-neutral-50 hover:border-neutral-300 transition-all flex items-center justify-center"
          >
            <Heart className="h-4 w-4" />
            {savedCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                {savedCount}
              </span>
            )}
          </Link>

          {/* User Profile or Login */}
          {user ? (
            <div className="relative hidden md:block" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-label="Toggle user menu"
                aria-expanded={isUserMenuOpen}
                className="flex items-center gap-2 rounded-full p-0.5 border border-neutral-200 hover:border-neutral-400 transition-all focus:outline-none focus:ring-2 focus:ring-black/10"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-white text-xs font-bold shadow-xs">
                  {user.fullName ? user.fullName[0].toUpperCase() : "U"}
                </div>
              </button>

              {/* Profile Dropdown Popup */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl z-50 animate-in fade-in-0 zoom-in-95 duration-150">
                  {/* User info header */}
                  <div className="px-3 py-2.5 border-b border-neutral-100">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-neutral-900 truncate">
                        {user.fullName || "User"}
                      </p>
                      <Badge variant="subtle" size="sm" className="text-[10px] uppercase font-bold shrink-0">
                        {user.role || "tourist"}
                      </Badge>
                    </div>
                    <p className="text-xs text-neutral-600 truncate mt-0.5">
                      {user.email}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-1 font-medium">
                      Role: {roleLabel}
                    </p>
                  </div>

                  {/* Actions / Links */}
                  <div className="py-1 space-y-0.5 text-xs">
                    {dashboardRoute && (
                      <Link
                        href={dashboardRoute}
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-neutral-900 bg-neutral-100/70 hover:bg-neutral-100 font-semibold transition-colors"
                      >
                        <span>
                          {user.role === "resort"
                            ? "🏨 Resort Operations Portal"
                            : user.role === "homestay"
                            ? "🏡 Homestay Host Portal"
                            : "🛡️ Admin Operations Portal"}
                        </span>
                        <span className="text-[10px] text-neutral-600 font-normal">Open &rarr;</span>
                      </Link>
                    )}

                    <Link
                      href="/wishlist"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-neutral-700 hover:bg-neutral-50 font-medium transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" />
                        <span>Saved Stays (Wishlist)</span>
                      </div>
                      {savedCount > 0 && (
                        <Badge variant="subtle" size="sm" className="text-[10px] bg-red-50 text-red-600 font-bold px-1.5 py-0.5">
                          {savedCount}
                        </Badge>
                      )}
                    </Link>

                    <Link
                      href="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-neutral-700 hover:bg-neutral-50 font-medium transition-colors"
                    >
                      <User className="h-3.5 w-3.5 text-neutral-500" />
                      <span>Account Profile</span>
                    </Link>

                    {user.role === "tourist" && (
                      <Link
                        href="/bookings"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-neutral-700 hover:bg-neutral-50 font-medium transition-colors"
                      >
                        <Compass className="h-3.5 w-3.5 text-neutral-500" />
                        <span>My Bookings</span>
                      </Link>
                    )}
                  </div>

                  {/* Sign Out */}
                  <div className="pt-1 border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors"
                    >
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="text-xs font-semibold text-neutral-900 px-3.5 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 hover:border-neutral-300 transition-all shadow-2xs active:scale-95 cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </div>


      {/* Search & Filter Subheader */}
      <div className="border-t border-neutral-200/30 bg-transparent py-2.5 px-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-2 sm:gap-3">
          {/* Search Input Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search homestays, resorts, or islands in Bretania..."
              className="w-full h-10 pl-9 pr-9 rounded-xl border border-neutral-200 bg-white text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-neutral-500 hover:text-neutral-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Trigger Button */}
          {onOpenFilters && (
            <button
              type="button"
              onClick={onOpenFilters}
              className={cn(
                "relative flex h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-medium transition-all select-none",
                activeFiltersCount > 0
                  ? "border-black bg-black text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 active:bg-neutral-100"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 && (
                <Badge
                  size="sm"
                  variant="secondary"
                  className="ml-0.5 bg-white text-black font-bold h-4 px-1 rounded-full text-[10px]"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Pop-up Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={onLoginSuccess}
      />
    </header>
  );
}
