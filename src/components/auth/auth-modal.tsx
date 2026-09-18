"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Logo } from "@/components/shared/logo";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Loader2, X, Lock, Mail, User, Phone } from "lucide-react";
import { ROLE_HOME_ROUTES, type UserRole } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, registerSchema, type LoginFormData, type RegisterFormData } from "@/lib/validations/auth";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
  onLoginSuccess?: () => void;
}

export function AuthModal({ isOpen, onClose, initialMode = "login", onLoginSuccess }: AuthModalProps) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // (Removed from here to avoid TDZ, moved below form declarations)

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Login form
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Register form
  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      phone: "",
    },
  });

  // Reset forms when modal opens or initialMode changes
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      loginForm.reset();
      registerForm.reset();
    }
  }, [isOpen, initialMode, loginForm.reset, registerForm.reset]);

  async function onLoginSubmit(data: LoginFormData) {
    setError("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (authData.user) {
        toast.success("Signed in successfully!");

        // Determine target dashboard
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authData.user.id)
          .maybeSingle<{ role: string }>();

        const dbRole = profile?.role;
        const appRole = authData.user.app_metadata?.role;

        // Strict least-privilege default fallback to 'tourist'
        const role = (dbRole || appRole || "tourist") as UserRole;
        const homeRoute = ROLE_HOME_ROUTES[role] || "/";

        if (onLoginSuccess) {
          onLoginSuccess();
        }

        const currentPath = window.location.pathname;
        if (currentPath !== homeRoute) {
          router.push(homeRoute);
        }
        onClose();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function onRegisterSubmit(data: RegisterFormData) {
    setError("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: authError, data: authData } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            phone_number: data.phone,
            role: "tourist",
          },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (authData.session) {
        toast.success("Account created successfully!");
        const homeRoute = ROLE_HOME_ROUTES["tourist" as UserRole] || "/";
        if (onLoginSuccess) {
          onLoginSuccess();
        }

        const currentPath = window.location.pathname;
        if (currentPath !== homeRoute) {
          router.push(homeRoute);
        }
        onClose();
      } else {
        toast.success("Registration received! You can now sign in.");
        setMode("login");
        loginForm.setValue("email", data.email);
      }
    } catch {
      setError("An unexpected error occurred during registration.");
    } finally {
      setIsLoading(false);
    }
  }


  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Full Screen Backdrop with Deep Blur across the entire page */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in-0 duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md my-auto rounded-3xl bg-white p-6 sm:p-8 shadow-2xl ring-1 ring-black/10 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in-0 duration-200"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-4 top-4 rounded-full p-2 text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Brand Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="flex justify-center mb-3">
            <Logo size="large" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            {mode === "login" ? "Welcome back" : "Create an account"}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600">
            {mode === "login"
              ? "Sign in to access your bookings & operator portal"
              : "Join the San Agustin Resort & Homestay community"}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === "login"
                ? "bg-white text-black shadow-xs"
                : "text-neutral-600 hover:text-black"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === "register"
                ? "bg-white text-black shadow-xs"
                : "text-neutral-600 hover:text-black"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-600 flex items-start gap-2">
            <span>{error}</span>
          </div>
        )}

        {/* LOGIN MODE */}
        {mode === "login" && (
          <div className="space-y-4">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="login-email" className="text-xs font-semibold text-neutral-700">Email Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                          <Input
                            id="login-email"
                            autoComplete="email"
                            placeholder="admin@sarah.test"
                            type="email"
                            className="h-10 pl-9 rounded-xl border-neutral-300 text-xs sm:text-sm focus-visible:ring-black"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs text-red-500" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="login-password" className="text-xs font-semibold text-neutral-700">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                          <Input
                            id="login-password"
                            autoComplete="current-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="h-10 pl-9 pr-10 rounded-xl border-neutral-300 text-xs sm:text-sm focus-visible:ring-black"
                            {...field}
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
                      </FormControl>
                      <FormMessage className="text-xs text-red-500" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 rounded-xl bg-black text-white hover:bg-neutral-800 text-xs font-bold transition-all mt-2"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Sign In to Portal"}
                </Button>
              </form>
            </Form>

          </div>
        )}

        {/* REGISTER MODE */}
        {mode === "register" && (
          <Form {...registerForm}>
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-3.5">
              <FormField
                control={registerForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="register-fullName" className="text-xs font-semibold text-neutral-700">Full Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <Input
                          id="register-fullName"
                          autoComplete="name"
                          placeholder="Juan Dela Cruz"
                          className="h-10 pl-9 rounded-xl border-neutral-300 text-xs sm:text-sm focus-visible:ring-black"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs text-red-500" />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="register-email" className="text-xs font-semibold text-neutral-700">Email Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <Input
                          id="register-email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          type="email"
                          className="h-10 pl-9 rounded-xl border-neutral-300 text-xs sm:text-sm focus-visible:ring-black"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs text-red-500" />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="register-phone" className="text-xs font-semibold text-neutral-700">Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <Input
                          id="register-phone"
                          autoComplete="tel"
                          placeholder="0912 345 6789"
                          className="h-10 pl-9 rounded-xl border-neutral-300 text-xs sm:text-sm focus-visible:ring-black"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs text-red-500" />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="register-password" className="text-xs font-semibold text-neutral-700">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <Input
                          id="register-password"
                          autoComplete="new-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Min. 8 characters"
                          className="h-10 pl-9 pr-10 rounded-xl border-neutral-300 text-xs sm:text-sm focus-visible:ring-black"
                          {...field}
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
                    </FormControl>
                    <FormMessage className="text-xs text-red-500" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 rounded-xl bg-black text-white hover:bg-neutral-800 text-xs font-bold transition-all mt-3"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Complete Registration"}
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>,
    document.body
  );
}
