import {
  LayoutDashboard,
  Users,
  Building2,
  Receipt,
  Megaphone,
  CalendarCheck,
  BedDouble,
  MessageSquare,
  Home,
  Compass,
  Ticket,
  User,
  Ship,
  BarChart3,
  CalendarRange,
  Briefcase,
  Settings,
  Anchor,
  Star,
  Wallet,
  type LucideIcon,
} from "lucide-react";

// ============================================================
// USER ROLES
// ============================================================

export const USER_ROLES = {
  ADMIN: "admin",
  HOMESTAY: "homestay",
  RESORT: "resort",
  TOURIST: "tourist",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// ============================================================
// ROLE HOME ROUTES (where each role lands after login)
// ============================================================

export const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  admin: "/admin",
  homestay: "/homestay",
  resort: "/resort",
  tourist: "/",
};

// ============================================================
// NAVIGATION ITEMS PER ROLE
// ============================================================

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  disabled?: boolean;
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Properties", href: "/admin/properties", icon: Building2 },
  { label: "Dues Tracker", href: "/admin/dues", icon: Receipt, disabled: true },
  { label: "Transactions", href: "/admin/transactions", icon: Briefcase },
  { label: "Announcements", href: "/admin/announcements", icon: Megaphone },
  { label: "Chat", href: "/admin/chat", icon: MessageSquare },
  { label: "Content", href: "/admin/content", icon: Settings },
];

export const HOMESTAY_NAV_ITEMS: NavItem[] = [
  { label: "Today", href: "/homestay", icon: CalendarCheck },
  { label: "Rooms", href: "/homestay/rooms", icon: BedDouble },
  { label: "Bookings", href: "/homestay/bookings", icon: Ticket },
  { label: "Services", href: "/homestay/services", icon: Compass },
  { label: "Dispatch", href: "/homestay/dispatch", icon: Anchor },
  { label: "Chat", href: "/homestay/chat", icon: MessageSquare },
  { label: "Reviews", href: "/homestay/reviews", icon: Star },
  { label: "Overview & Policies", href: "/homestay/profile", icon: Building2 },
  { label: "Payout Settings", href: "/homestay/settings", icon: Wallet },
];

export const RESORT_NAV_ITEMS: NavItem[] = [
  { label: "Analytics", href: "/resort", icon: BarChart3 },
  { label: "Rooms", href: "/resort/rooms", icon: BedDouble },
  { label: "Bookings", href: "/resort/bookings", icon: Ticket },
  { label: "Services", href: "/resort/services", icon: Ship },
  { label: "Dispatch", href: "/resort/dispatch", icon: Anchor },
  { label: "Calendar", href: "/resort/calendar", icon: CalendarRange },
  { label: "Chat", href: "/resort/chat", icon: MessageSquare },
  { label: "Reviews", href: "/resort/reviews", icon: Star },
  { label: "Overview & Policies", href: "/resort/profile", icon: Building2 },
  { label: "Payout Settings", href: "/resort/settings", icon: Wallet },
];

export const TOURIST_NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Explore", href: "/explore", icon: Compass },
  { label: "Bookings", href: "/bookings", icon: Ticket },
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "Profile", href: "/profile", icon: User },
];

// ============================================================
// STORAGE BUCKET NAMES
// ============================================================

export const STORAGE_BUCKETS = {
  PROPERTY_IMAGES: "property-images",
  ROOM_GALLERIES: "room-galleries",
  PAYMENT_RECEIPTS: "payment-receipts",
  USER_AVATARS: "user-avatars",
} as const;

// ============================================================
// PUBLIC ROUTES (no auth required)
// ============================================================

export const PUBLIC_ROUTES = [
  "/",
  "/property",
  "/explore",
];

// ============================================================
// STATUS COLORS
// ============================================================

export const PROPERTY_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  renovating: "bg-amber-50 text-amber-700 border-amber-200",
  full: "bg-blue-50 text-blue-700 border-blue-200",
  closed: "bg-red-50 text-red-700 border-red-200",
};

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  accepted: "bg-green-50 text-green-700 border-green-200",
  declined: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-gray-50 text-gray-700 border-gray-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
};

export const DUES_STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-50 text-green-700 border-green-200",
  unpaid: "bg-amber-50 text-amber-700 border-amber-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
};

