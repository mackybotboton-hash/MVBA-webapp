"use client";

import { useEffect, useRef } from "react";
import OneSignal from "react-onesignal";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function PushInitializer({ userId }: { userId?: string }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const runOneSignal = async () => {
      try {
        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
        if (!appId) {
          console.warn("OneSignal App ID not found in environment.");
          return;
        }

        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: process.env.NODE_ENV === "development",
        });

        // If user is logged in, bind their OneSignal Player ID to their Supabase Profile
        if (userId) {
          // In OneSignal web SDK v16+, you login users with their external ID
          await OneSignal.login(userId);

          // We also listen for permission changes to potentially save the explicit Subscription ID to the DB if needed
          OneSignal.User.PushSubscription.addEventListener("change", async (subscription) => {
            if (subscription.current.optedIn && subscription.current.id) {
              const supabase = createClient();
              const { error } = await supabase
                .from("profiles")
                .update({ onesignal_id: subscription.current.id } as any)
                .eq("id", userId);

              if (error) {
                console.error("Failed to sync OneSignal ID to profile:", error);
              } else {
                toast.success("Push notifications enabled!");
              }
            }
          });
        }
      } catch (error) {
        console.error("Error initializing OneSignal:", error);
      }
    };

    runOneSignal();
  }, [userId]);

  return null;
}
