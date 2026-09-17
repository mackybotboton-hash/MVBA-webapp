"use client";

import * as React from "react";
import {
  AlertTriangle,
  Waves,
  PhoneCall,
  X,
  ShieldAlert,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface WeatherAlertBannerProps {
  variant?: "top" | "card";
}

export function WeatherAlertBanner({ variant = "card" }: WeatherAlertBannerProps) {
  const [activeAlert, setActiveAlert] = React.useState<{
    title: string;
    message: string;
    urgency: "gale_warning" | "advisory";
    created_at: string;
  } | null>(null);

  const [isDismissed, setIsDismissed] = React.useState(false);

  React.useEffect(() => {
    // Fetch live alert from Supabase announcements
    const checkAlerts = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("announcements")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          const ann = (data as any[])[0];
          const isGale =
            ann.title?.toLowerCase().includes("gale") ||
            ann.title?.toLowerCase().includes("warning");
          setActiveAlert({
            title: ann.title,
            message: ann.content,
            urgency: isGale ? "gale_warning" : "advisory",
            created_at: new Date(ann.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          });
        } else {
          setActiveAlert(null);
        }
      } catch {
        setActiveAlert(null);
      }
    };

    checkAlerts();
  }, []);

  if (isDismissed || !activeAlert) return null;


  return (
    <div
      role="alert"
      className={`rounded-2xl border ${
        activeAlert.urgency === "gale_warning"
          ? "border-amber-300 bg-amber-50/90 text-amber-950"
          : "border-neutral-200 bg-neutral-50 text-neutral-900"
      } p-4 sm:p-5 shadow-xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
            activeAlert.urgency === "gale_warning"
              ? "bg-amber-500 text-white shadow-xs"
              : "bg-black text-white"
          }`}
        >
          <Waves className="h-5 w-5" />
        </div>

        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider ${
                activeAlert.urgency === "gale_warning"
                  ? "bg-amber-200 text-amber-900"
                  : "bg-neutral-200 text-neutral-900"
              }`}
            >
              Coast Guard Advisory
            </span>
            <h3 className="font-bold text-sm sm:text-base leading-snug">
              {activeAlert.title}
            </h3>
            <span className="text-[11px] text-amber-800/80 font-medium">
              • {activeAlert.created_at}
            </span>
          </div>

          <p className="text-xs leading-relaxed text-amber-900/90 font-medium max-w-3xl">
            {activeAlert.message}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-semibold text-amber-950/80">
            <span className="flex items-center gap-1">
              <PhoneCall className="h-3.5 w-3.5 text-amber-700" />
              <span>PCG Lianga Station: (0917) 849-2041</span>
            </span>
            <span>•</span>
            <span>MDRRMO San Agustin Rescue: (0928) 123-4567</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => setIsDismissed(true)}
        aria-label="Dismiss alert"
        className="self-start sm:self-center p-1.5 rounded-lg text-amber-800/70 hover:text-amber-950 hover:bg-amber-200/60 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
