"use client";

import { AuthModal } from "@/components/auth/auth-modal";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function RegisterClientPage() {
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
      onClose={() => router.push("/")} 
      initialMode="register"
      onLoginSuccess={() => {
        const redirectUrl = searchParams.get("redirect") || "/";
        router.push(redirectUrl);
      }}
    />
  );
}
