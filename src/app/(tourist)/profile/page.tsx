import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Settings,
  User,
  MapPin,
  Heart,
  Ticket,
  ShieldCheck,
  HelpCircle,
  ChevronRight,
  PhoneCall,
} from "lucide-react";
import { getInitials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/shared/logo";
import { SignOutButton } from "./sign-out-button";
import { ProfileActivityStats } from "./profile-activity-stats";

export default async function TouristProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const userProfile = (profile as any) || {
    full_name: user.email?.split("@")[0] || "Tourist",
    email: user.email,
    role: "tourist",
  };

  const { data: helplineData } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "helpline")
    .maybeSingle();

  const defaultHelpline = {
    phone: "(+63) 912-345-6789",
    description:
      "Need urgent assistance, weather updates, or boat coastguard verification? Contact the San Agustin Municipal Tourism Office at (+63) 912-345-6789.",
  };

  const helpline = helplineData?.value || defaultHelpline;

  const isOwnerOrAdmin = ["resort", "homestay", "admin"].includes(userProfile.role);
  const portalUrl =
    userProfile.role === "resort"
      ? "/resort"
      : userProfile.role === "homestay"
      ? "/homestay"
      : userProfile.role === "admin"
      ? "/admin"
      : null;

  const roleTitle =
    userProfile.role === "resort"
      ? "Resort Operator"
      : userProfile.role === "homestay"
      ? "Homestay Host"
      : userProfile.role === "admin"
      ? "MVBA Administrator"
      : "Verified Guest";

  return (
    <div className="min-h-screen bg-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo size="small" />
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Account Profile
            </span>
          </div>

          <Link
            href="/"
            className="text-xs font-semibold text-neutral-900 hover:underline"
          >
            Discover Stays
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4 sm:p-6 space-y-6 pb-24 md:pb-8">
        {/* Management Portal Banner for Owners/Admins */}
        {portalUrl && (
          <div className="rounded-2xl border border-neutral-900 bg-neutral-900 text-white p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Operator Access
              </span>
              <h2 className="text-base font-bold text-white">
                {userProfile.role === "resort"
                  ? "Resort Management Portal"
                  : userProfile.role === "homestay"
                  ? "Homestay Host Portal"
                  : "MVBA Admin Operations Portal"}
              </h2>
              <p className="text-xs text-neutral-300">
                Manage your listings, bookings, dues, and member analytics.
              </p>
            </div>
            <Link
              href={portalUrl}
              className="px-4 py-2.5 rounded-xl bg-white text-black text-xs font-bold hover:bg-neutral-100 transition-all shrink-0"
            >
              Open Dashboard &rarr;
            </Link>
          </div>
        )}

        {/* Profile Card */}
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          <div className="w-18 h-18 rounded-full bg-black text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-sm">
            {getInitials(userProfile.full_name || userProfile.email || "User")}
          </div>

          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-xl font-bold text-neutral-900">
                {userProfile.full_name || "Account User"}
              </h1>
              <Badge variant="subtle" size="sm" className="bg-white">
                <ShieldCheck className="h-3 w-3 text-emerald-600 mr-1" />
                {roleTitle}
              </Badge>
            </div>

            <p className="text-xs sm:text-sm text-neutral-600">
              {userProfile.email}
            </p>

            <div className="flex items-center justify-center sm:justify-start gap-1 text-xs text-neutral-600 pt-1">
              <MapPin className="h-3.5 w-3.5 text-neutral-500" />
              <span>San Agustin, Surigao del Sur</span>
            </div>
          </div>
        </div>


        {/* Quick Activity Stats */}
        {/* Quick Activity Stats */}
        <ProfileActivityStats />

        {/* Menu Items */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest px-1">
            Preferences & Information
          </h2>

          {[
            {
              icon: Heart,
              label: "My Wishlist & Saved Stays",
              desc: "View short-listed resorts and homestays",
              href: "/wishlist",
              badge: "Saved",
            },
            {
              icon: Ticket,
              label: "My Bookings & Receipts",
              desc: "View reservation confirmations & status",
              href: "/bookings",
            },
            {
              icon: User,
              label: "Personal Information",
              desc: "Manage your contact name and mobile number",
              href: "#",
            },
            {
              icon: HelpCircle,
              label: "MVBA Association Guidelines",
              desc: "Environmental rules, boat rates & emergency hotlines",
              href: "/explore",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 transition-all group text-left"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-neutral-600 group-hover:text-black" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900 group-hover:text-black">
                      {item.label}
                    </p>
                    <p className="text-xs text-neutral-600">{item.desc}</p>
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 text-neutral-500 group-hover:text-neutral-700 transition-colors" />
              </Link>
            );
          })}
        </div>

        {/* Local Emergency Hotlines Card */}
        <div className="rounded-xl border border-neutral-200 p-4 bg-neutral-50 text-xs space-y-2">
          <div className="flex items-center gap-2 font-semibold text-neutral-800">
            <PhoneCall className="h-4 w-4 text-neutral-700" />
            <span>San Agustin Tourism & Emergency Helpline</span>
          </div>
          <p className="text-neutral-600 text-[11px] leading-relaxed">
            {helpline.description || `Need urgent assistance, weather updates, or boat coastguard verification? Contact the San Agustin Municipal Tourism Office at ${helpline.phone || "(+63) 912-345-6789"}.`}
          </p>
        </div>

        {/* Sign Out Action */}
        <div className="pt-2">
          <SignOutButton />
        </div>
      </main>
    </div>
  );
}
