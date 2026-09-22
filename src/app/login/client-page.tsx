"use client";

import { AuthModal } from "@/components/auth/auth-modal";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getSafeRedirectUrl } from "@/lib/utils";

export function AuthClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <AuthModal 
      isOpen={true} 
      // If they click the X to close the modal on the dedicated login page,
      // redirect them back to the home page instead of leaving them on a blank screen.
      onClose={() => router.push("/")} 
      initialMode="login"
      onLoginSuccess={() => {
        // If they were trying to go to a specific page (e.g. /bookings),
        // the middleware passed ?redirect=/bookings. Send them there safely!
        const redirectUrl = getSafeRedirectUrl(searchParams.get("redirect"), "/");
        router.push(redirectUrl);
      }}
    />
  );
}
