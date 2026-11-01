"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isCheckingLink, setIsCheckingLink] = useState(true);

  useEffect(() => {
    // 1. Inspect search params for Supabase errors
    const errorParam = searchParams.get("error");
    const errorDesc = searchParams.get("error_description");

    if (errorParam || errorDesc) {
      setLinkError(
        errorDesc || "This password reset link is invalid or has expired. Please request a new one."
      );
      setIsCheckingLink(false);
      return;
    }

    // 2. Inspect hash fragment for Supabase errors (implicit flow)
    if (typeof window !== "undefined" && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashError = hashParams.get("error");
      const hashErrorDesc = hashParams.get("error_description");
      if (hashError || hashErrorDesc) {
        setLinkError(
          hashErrorDesc || "This password reset link is invalid or has expired. Please request a new one."
        );
        setIsCheckingLink(false);
        return;
      }
    }

    // 3. Verify Supabase session or listen for auth recovery event
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setLinkError(null);
        setIsCheckingLink(false);
      }
    });

    // Also check current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const code = searchParams.get("code");
      const hasHash = typeof window !== "undefined" && window.location.hash.includes("access_token");

      if (code && !session) {
        // Exchange code client-side if the user landed on /auth/reset-password directly
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) {
          setLinkError(
            "This password reset link is invalid or has expired. Please request a new one."
          );
        } else {
          setLinkError(null);
        }
        setIsCheckingLink(false);
        return;
      }

      if (session || hasHash) {
        setLinkError(null);
      } else {
        setLinkError(
          "This password reset link is invalid or has expired. Please request a new one."
        );
      }
      setIsCheckingLink(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation matching sign-up schema
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify both fields.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message || "Failed to update password. Please try again.");
        return;
      }

      setIsSuccess(true);
      toast.success("Password reset successfully! Please sign in with your new password.");

      // Cleanly sign out so the user signs in fresh with the new password
      await supabase.auth.signOut();

      // Redirect to sign in after a brief moment
      setTimeout(() => {
        router.push("/login?reset=success");
      }, 1500);
    } catch {
      setError("An unexpected error occurred while resetting your password.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl ring-1 ring-black/10 animate-in zoom-in-95 fade-in-0 duration-200">
      {/* Brand Header */}
      <div className="text-center space-y-1.5 mb-6">
        <div className="flex justify-center mb-3">
          <Logo size="large" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
          {isSuccess ? "Password updated" : "Create new password"}
        </h1>
        <p className="text-xs sm:text-sm text-neutral-600">
          {isSuccess
            ? "Your password has been changed. Redirecting to sign in..."
            : "Enter a new secure password for your account."}
        </p>
      </div>

      {/* Link Invalid / Expired State */}
      {linkError && !isSuccess && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-amber-900 text-xs sm:text-sm space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Reset Link Invalid or Expired</span>
            </div>
            <p className="text-neutral-600 text-xs leading-relaxed">
              {linkError}
            </p>
          </div>

          <Link
            href="/login"
            className="w-full h-11 rounded-xl bg-black text-white hover:bg-neutral-800 text-xs sm:text-sm font-bold transition-all flex items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Return to Sign In
          </Link>
        </div>
      )}

      {/* Success State */}
      {isSuccess && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-xs sm:text-sm space-y-2 text-center">
            <div className="flex justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="font-semibold text-neutral-900 text-sm">
              Your password has been reset!
            </p>
            <p className="text-neutral-600 text-xs">
              You will be redirected to the sign in page momentarily.
            </p>
          </div>

          <Link
            href="/login?reset=success"
            className="w-full h-11 rounded-xl bg-black text-white hover:bg-neutral-800 text-xs sm:text-sm font-bold transition-all flex items-center justify-center"
          >
            Sign In with New Password
          </Link>
        </div>
      )}

      {/* Form State */}
      {!linkError && !isSuccess && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-600 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* New Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="new-password"
              className="text-xs font-semibold text-neutral-700"
            >
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 pl-9 pr-10 rounded-xl border-neutral-300 text-xs sm:text-sm focus-visible:ring-black"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-neutral-500">
              Must be at least 6 characters long
            </p>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="confirm-password"
              className="text-xs font-semibold text-neutral-700"
            >
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-10 pl-9 pr-10 rounded-xl border-neutral-300 text-xs sm:text-sm focus-visible:ring-black"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading || isCheckingLink}
            className="w-full h-11 rounded-xl bg-black text-white hover:bg-neutral-800 text-xs sm:text-sm font-bold transition-all mt-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            ) : (
              "Save New Password"
            )}
          </Button>

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="text-xs font-semibold text-neutral-500 hover:text-black transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
