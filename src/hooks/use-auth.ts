"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types/database";
import type { User } from "@supabase/supabase-js";

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
}

// Global in-memory singleton cache to prevent duplicate database queries across components
let globalAuthState: AuthState = {
  user: null,
  profile: null,
  isLoading: true,
};

let listeners: Set<(state: AuthState) => void> = new Set();
let isInitialized = false;
let inFlightFetch: Promise<void> | null = null;

function notifyListeners() {
  listeners.forEach((listener) => listener(globalAuthState));
}

async function fetchSessionAndProfile(): Promise<void> {
  if (inFlightFetch) return inFlightFetch;

  inFlightFetch = (async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        globalAuthState = { user: null, profile: null, isLoading: false };
        notifyListeners();
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      const fallbackProfile: Profile = {
        id: session.user.id,
        email: session.user.email || "",
        full_name:
          session.user.user_metadata?.full_name ||
          session.user.email?.split("@")[0] ||
          "User",
        role: (session.user.user_metadata?.role as Profile["role"]) || "tourist",
        phone_number: session.user.user_metadata?.phone_number || "",
        avatar_url: session.user.user_metadata?.avatar_url || "",
        is_approved: true,
        created_at: session.user.created_at,
        updated_at: session.user.updated_at || session.user.created_at,
      };

      const resolvedProfile: Profile = profile
        ? { ...fallbackProfile, ...(profile as unknown as Profile) }
        : fallbackProfile;

      globalAuthState = {
        user: session.user,
        profile: resolvedProfile,
        isLoading: false,
      };
      notifyListeners();
    } catch (err) {
      console.error("Error in singleton auth loader:", err);
      // Keep existing state if it's already authenticated to avoid flashing
      if (!globalAuthState.user) {
        globalAuthState = { user: null, profile: null, isLoading: false };
        notifyListeners();
      }
    } finally {
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
}

function initAuthSingleton() {
  if (isInitialized) return;
  isInitialized = true;

  const supabase = createClient();
  fetchSessionAndProfile();

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      globalAuthState = { user: null, profile: null, isLoading: false };
      notifyListeners();
    } else if (session?.user) {
      fetchSessionAndProfile();
    }
  });
}

/**
 * High-performance useAuth hook backed by an in-memory singleton store.
 * Eliminates duplicate PostgreSQL calls and synchronizes all components at 0ms cost.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(globalAuthState);

  useEffect(() => {
    initAuthSingleton();

    const handleChange = (newState: AuthState) => {
      setState(newState);
    };

    listeners.add(handleChange);
    // Sync current state immediately in case it changed before listener attached
    setState(globalAuthState);

    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  return state;
}
