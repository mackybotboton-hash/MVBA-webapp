"use client";

import { useEffect, useRef } from "react";
import OneSignal from "react-onesignal";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

/**
 * PushInitializer — self-contained OneSignal setup component.
 *
 * This component reads the current Supabase session itself rather than
 * receiving a userId prop. This is necessary because the root layout.tsx
 * is a Server Component and cannot access the auth session at render time
 * without making the full layout dynamic.
 *
 * Mount this component once inside the root QueryProvider. It will:
 *   1. Initialize the OneSignal SDK
 *   2. Prompt the user to subscribe to push notifications
 *   3. When the user subscribes (or is already subscribed), bind their
 *      OneSignal subscription ID to their Supabase profile row via
 *      OneSignal.login(userId) — this is what makes targeted push work.
 *   4. Listen for subscription changes and sync the subscription ID to the DB.
 */
export function PushInitializer() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const runOneSignal = async () => {
      try {
        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
        if (!appId) {
          console.warn("[OneSignal] App ID not found. Skipping push init.");
          return;
        }

        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: process.env.NODE_ENV === "development",
        });

        // Prompt the user to subscribe to push notifications
        OneSignal.Slidedown.promptPush();

        // Read the current session so we can bind the subscription to the user.
        // We do this INSIDE the hook (client-side) because the root layout is
        // a Server Component and cannot forward the userId safely.
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const userId = session?.user?.id;
        if (!userId) return; // Not logged in — no binding needed

        // Login the user with their Supabase UUID as the external ID.
        // This maps all their push subscriptions (web, mobile) to one identity.
        await OneSignal.login(userId);

        // Also save the raw subscription ID to the profiles table as a fallback
        // for the server-side `/api/notify` route that uses include_subscription_ids.
        OneSignal.User.PushSubscription.addEventListener(
          "change",
          async (subscription) => {
            if (subscription.current.optedIn && subscription.current.id) {
              const { error } = await supabase
                .from("profiles")
                .update({ onesignal_id: subscription.current.id } as never)
                .eq("id", userId);

              if (error) {
                console.error("[OneSignal] Failed to sync subscription ID:", error);
              } else {
                toast.success("Push notifications enabled!", { duration: 2000 });
              }
            }
          }
        );
      } catch (error) {
        // Swallowed — push init failure must never break the app
        console.error("[OneSignal] Initialization error:", error);
      }
    };

    runOneSignal();
  }, []); // Run once on mount

  return null;
}
