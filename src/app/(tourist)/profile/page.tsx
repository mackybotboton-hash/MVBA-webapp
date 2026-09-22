import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { getInitials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/shared/logo";
import { SignOutButton } from "./sign-out-button";
import { ProfileActivityStats } from "./profile-activity-stats";
import { ProfileSettingsGrid } from "@/components/tourist/profile-settings-grid";

export default async function TouristProfilePage() {
  const supabase = (await createClient()) as any;
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
    id: user.id,
    full_name: user.email?.split("@")[0] || "Tourist",
    email: user.email,
    role: "tourist",
    phone_number: "",
  };

  const { data: announcementsData } = await supabase
    .from("announcements")
    .select("title")
    .eq("is_active", true)
    .in("target_role", ["all", "tourist"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const helpSupportDesc =
    announcementsData?.title ||
    "MVBA Guidelines and Emergency Hotlines (MDRRMO, Local Police)";

  return (
    <div className="min-h-screen bg-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
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

      <main className="mx-auto max-w-4xl p-4 sm:p-6 space-y-8 pb-24 md:pb-12 mt-4">
        {/* Profile Heading Section */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          <div className="w-24 h-24 rounded-full bg-black text-white flex items-center justify-center text-3xl font-bold shrink-0 shadow-sm">
            {getInitials(userProfile.full_name || userProfile.email || "User")}
          </div>

          <div className="space-y-2 flex-1 pt-2">
            <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">
              {userProfile.full_name || "Account User"}
            </h1>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <p className="text-sm text-neutral-600 font-medium">
                {userProfile.email}
              </p>
              <Badge
                variant="subtle"
                size="sm"
                className="bg-emerald-50 text-emerald-700 border border-emerald-100"
              >
                <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                Verified Guest
              </Badge>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-1 text-sm text-neutral-500 pt-1">
              <MapPin className="h-4 w-4" />
              <span>San Agustin, Surigao del Sur</span>
            </div>
          </div>
        </div>

        {/* Quick Activity Stats */}
        <div className="pt-2">
          <ProfileActivityStats />
        </div>

        {/* Settings Grid - Airbnb Style with Full Interactive Modals */}
        <div className="pt-4">
          <h2 className="text-2xl font-bold text-neutral-900 mb-6">
            Account settings
          </h2>

          <ProfileSettingsGrid
            initialProfile={userProfile}
            helpSupportDesc={helpSupportDesc}
          />
        </div>

        {/* Sign Out Action */}
        <div className="pt-8 border-t border-neutral-200 flex justify-center sm:justify-start">
          <div className="w-full sm:w-auto">
            <SignOutButton />
          </div>
        </div>
      </main>
    </div>
  );
}
