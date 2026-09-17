"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  ShieldAlert,
  Home,
  Building2,
  Compass,
  ChevronUp,
  Check,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function DevRoleSwitcher() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentRole, setCurrentRole] = React.useState<string | null>(null);
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [isSwitching, setIsSwitching] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    async function loadRole() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setCurrentUser(user);
          const { data } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

          if (data) {
            setCurrentRole((data as any).role);
          }
        }
      } catch {
        // Ignored
      }
    }

    loadRole();
  }, [pathname]);

  const switchRole = async (targetRole: string, targetPath: string) => {
    if (!currentUser) {
      router.push(targetPath);
      return;
    }

    setIsSwitching(true);
    try {
      const supabase = createClient();
      const { error } = await (supabase.from("profiles") as any)
        .update({ role: targetRole, is_approved: true })
        .eq("id", currentUser.id);

      if (error) throw error;

      setCurrentRole(targetRole);
      toast.success(`Switched role to ${targetRole}!`, {
        description: `Redirecting to ${targetPath}`,
      });

      router.push(targetPath);
      router.refresh();
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to switch role");
      router.push(targetPath);
    } finally {
      setIsSwitching(false);
    }
  };

  const roles = [
    {
      id: "tourist",
      label: "Tourist (Marketplace)",
      path: "/",
      icon: Compass,
      desc: "Browse stays, request bookings, chat with hosts",
    },
    {
      id: "homestay",
      label: "Homestay Owner",
      path: "/homestay",
      icon: Home,
      desc: "Manage homestay, rooms, and approve guests",
    },
    {
      id: "resort",
      label: "Resort Owner",
      path: "/resort",
      icon: Building2,
      desc: "Manage resort villas, boat tours & extra services",
    },
    {
      id: "admin",
      label: "Admin Portal",
      path: "/admin",
      icon: ShieldAlert,
      desc: "Association approvals, users, and properties",
    },
  ];

  return (
    <aside
      aria-label="Development Role Switcher"
      className="fixed bottom-4 left-4 z-50 print:hidden hidden sm:block"
    >
      <div className="relative">
        {isOpen && (
          <div className="absolute bottom-12 left-0 w-80 rounded-2xl border border-neutral-200 bg-white p-3 shadow-2xl space-y-2 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between px-2 py-1 border-b border-neutral-100 pb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-neutral-800" />
                <span className="text-xs font-bold text-neutral-900">
                  Quick Role Switcher
                </span>
              </div>
              <span className="text-[10px] text-neutral-500 font-mono">
                {currentUser?.email?.split("@")[0] || "guest"}
              </span>
            </div>

            <div className="space-y-1">
              {roles.map((r) => {
                const Icon = r.icon;
                const isCurrent = currentRole === r.id;

                return (
                  <button
                    key={r.id}
                    disabled={isSwitching}
                    onClick={() => switchRole(r.id, r.path)}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                      isCurrent
                        ? "border-black bg-neutral-100 text-black font-semibold"
                        : "border-transparent bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-200"
                    }`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 mt-0.5">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{r.label}</span>
                        {isCurrent && <Check className="h-3 w-3 text-black" />}
                      </div>
                      <p className="text-[10px] text-neutral-600 truncate mt-0.5">
                        {r.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-full border border-neutral-200 bg-white/95 backdrop-blur-md shadow-md text-xs font-semibold text-neutral-900 hover:border-neutral-300 transition-all select-none"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Role: {currentRole || "tourist"}</span>
          <ChevronUp
            className={`h-3.5 w-3.5 text-neutral-600 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
    </aside>
  );
}
