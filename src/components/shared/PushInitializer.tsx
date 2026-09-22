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
 *   1. Initialize the OneSignal SDK (once).
 *   2. Prompt the user to subscribe to push notifications.
 *   3. Subscribe to Supabase auth state changes and, whenever a real
 *      session is present, bind the OneSignal subscription to that user
 *      via OneSignal.login(userId) — this is what makes targeted push work.
 *   4. On logout, call OneSignal.logout() to unbind the device.
 *   5. Listen for subscription changes and sync the subscription ID to the DB.
 *
 * IMPORTANT: we intentionally do NOT rely on a single getSession() call on
 * mount. With @supabase/ssr, the client-side session frequently has not
 * finished rehydrating from cookies/local storage on the very first tick
 * after mount, so getSession() can return null even when the user is
 * actually logged in — causing login() to silently never fire. Instead we
 * use onAuthStateChange, which fires immediately with the current session
 * if already hydrated, AND fires again later once hydration completes.
 */
export function PushInitializer() {
  const sdkInitialized = useRef(false);
  const boundUserId = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const initSdkOnce = async () => {
      if (sdkInitialized.current) return;
      sdkInitialized.current = true;

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

        OneSignal.Slidedown.promptPush();

        // Sync the raw subscription ID to profiles as a fallback for the
        // server-side /api/notify route that can target by subscription id.
        OneSignal.User.PushSubscription.addEventListener(
          "change",
          async (subscription) => {
            const userId = boundUserId.current;
            if (!userId) return;
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
        // Swallowed — push init failure must never break the app.
        console.error("[OneSignal] Initialization error:", error);
      }
    };

    const bindUser = async (userId: string, attempt = 0): Promise<void> => {
      if (boundUserId.current === userId) return; // already bound, avoid redundant calls
      try {
        await OneSignal.login(userId);
        boundUserId.current = userId;
        console.log("[OneSignal] Bound external ID:", userId);
      } catch (error) {
        if (attempt < 3) {
          // OneSignal SDK internals can still be settling right after init()
          // resolves; back off briefly and retry rather than failing silently.
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          return bindUser(userId, attempt + 1);
        }
        console.error("[OneSignal] login() failed after retries:", error);
      }
    };

    const unbindUser = async () => {
      if (!boundUserId.current) return;
      try {
        await OneSignal.logout();
        boundUserId.current = null;
      } catch (error) {
        console.error("[OneSignal] logout() failed:", error);
      }
    };

    const run = async () => {
      await initSdkOnce();
      if (cancelled) return;

      // Handle whatever session is already hydrated at this point (may be
      // null if hydration is still in flight — onAuthStateChange below
      // will fire again once it resolves).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await bindUser(session.user.id);
      }
    };

    run();

    // The reliable source of truth: fires on initial hydration AND on
    // every subsequent sign-in/sign-out/token-refresh.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const userId = session?.user?.id;
        if (userId) {
          await bindUser(userId);
        } else if (event === "SIGNED_OUT") {
          await unbindUser();
        }
      }
    );

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return null;
}