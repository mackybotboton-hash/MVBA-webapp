"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function AuthListener() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    // 1. If code lands on root or any page other than /auth/callback, forward to callback handler
    if (code && !window.location.pathname.startsWith("/auth/callback")) {
      const callbackUrl = `/auth/callback?${params.toString()}`;
      window.location.href = callbackUrl;
      return;
    }

    // 2. If an OAuth error is present in the URL, toast a friendly message and clean up URL
    if (error || errorDescription) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);

      if (errorDescription?.includes("expired") || error === "bad_oauth_state") {
        toast.error("Google sign-in timed out. Please click Continue with Google again.");
      } else if (errorDescription) {
        toast.error(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
      }
    }
  }, []);

  return null;
}
