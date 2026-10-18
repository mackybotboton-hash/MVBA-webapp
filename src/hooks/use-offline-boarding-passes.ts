"use client";

import { useState, useEffect, useCallback } from "react";
import { BoardingPassData } from "@/lib/boarding-pass-generator";

const STORAGE_KEY = "mvba_offline_boarding_passes";

export interface CachedBoardingPass extends BoardingPassData {
  cached_at: string;
}

export function useOfflineBoardingPasses() {
  const [cachedPasses, setCachedPasses] = useState<CachedBoardingPass[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Monitor network online/offline events
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Hydrate cached passes from localStorage
  const loadCachedPasses = useCallback(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Strictly exclude any cancelled passes that might linger in storage
      return parsed.filter((p: any) => p && p.id && p.status !== "cancelled");
    } catch (e) {
      console.error("Failed to load offline boarding passes from storage:", e);
      return [];
    }
  }, []);

  useEffect(() => {
    const passes = loadCachedPasses();
    setCachedPasses(passes);
    setIsLoaded(true);
  }, [loadCachedPasses]);

  // Save or update a single pass
  const savePass = useCallback((pass: BoardingPassData) => {
    if (typeof window === "undefined") return;
    try {
      // If pass is cancelled, purge it from cache immediately
      if (pass.status === "cancelled") {
        const current = loadCachedPasses();
        const filtered = current.filter((p: CachedBoardingPass) => p.id !== pass.id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        setCachedPasses(filtered);
        return;
      }

      const current = loadCachedPasses();
      const existingIdx = current.findIndex((p: CachedBoardingPass) => p.id === pass.id);

      if (existingIdx >= 0) {
        const existing = current[existingIdx];
        if (
          existing.status === pass.status &&
          existing.property_name === pass.property_name &&
          existing.room_name === pass.room_name &&
          existing.check_in === pass.check_in &&
          existing.check_out === pass.check_out &&
          existing.total_price === pass.total_price &&
          existing.guests_count === pass.guests_count
        ) {
          return; // Identical, skip unnecessary update
        }
      }

      const newEntry: CachedBoardingPass = {
        ...pass,
        cached_at: existingIdx >= 0 ? current[existingIdx].cached_at : new Date().toISOString(),
      };

      let updated: CachedBoardingPass[];
      if (existingIdx >= 0) {
        updated = [...current];
        updated[existingIdx] = newEntry;
      } else {
        updated = [newEntry, ...current];
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setCachedPasses(updated);
    } catch (e) {
      console.error("Failed to save offline boarding pass:", e);
    }
  }, [loadCachedPasses]);

  // Bulk save passes (e.g. all confirmed bookings on tourist bookings page load)
  const saveMultiplePasses = useCallback((passes: BoardingPassData[]) => {
    if (typeof window === "undefined" || !passes.length) return;
    try {
      const current = loadCachedPasses();
      const passMap = new Map<string, CachedBoardingPass>();

      // Populate existing (excluding cancelled)
      current
        .filter((p) => p.status !== "cancelled")
        .forEach((p: CachedBoardingPass) => passMap.set(p.id, p));

      // Merge new confirmed passes
      const now = new Date().toISOString();
      passes
        .filter((p) => p.status !== "cancelled")
        .forEach((p) => {
          passMap.set(p.id, {
            ...p,
            cached_at: passMap.get(p.id)?.cached_at || now,
          });
        });

      const updated = Array.from(passMap.values());
      const isSame =
        current.length === updated.length &&
        updated.every((u, i) => current[i] && current[i].id === u.id && current[i].status === u.status);

      if (isSame) return;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setCachedPasses(updated);
    } catch (e) {
      console.error("Failed to batch save offline boarding passes:", e);
    }
  }, [loadCachedPasses]);

  // Authoritative sync: replaces or reconciles offline passes with confirmed/completed list
  const syncPasses = useCallback((authoritativePasses: BoardingPassData[]) => {
    if (typeof window === "undefined") return;
    try {
      const current = loadCachedPasses();
      const currentMap = new Map<string, CachedBoardingPass>();
      current.forEach((p: CachedBoardingPass) => currentMap.set(p.id, p));

      const now = new Date().toISOString();
      // Only keep passes that exist in authoritative list and are not cancelled
      const validOnly = authoritativePasses
        .filter((p) => p.status !== "cancelled")
        .map((p) => ({
          ...p,
          cached_at: currentMap.get(p.id)?.cached_at || now,
        }));

      // Check if actually changed to avoid unnecessary re-renders
      const isSame =
        current.length === validOnly.length &&
        validOnly.every((v, i) => {
          const c = current[i];
          return (
            c &&
            c.id === v.id &&
            c.status === v.status &&
            c.property_name === v.property_name &&
            c.room_name === v.room_name &&
            c.check_in === v.check_in &&
            c.check_out === v.check_out
          );
        });

      if (isSame) {
        return; // Avoid loop
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(validOnly));
      setCachedPasses(validOnly);
    } catch (e) {
      console.error("Failed to sync offline boarding passes:", e);
    }
  }, [loadCachedPasses]);

  // Check if a booking is cached
  const hasPass = useCallback(
    (bookingId: string) => {
      return cachedPasses.some((p) => p.id === bookingId && p.status !== "cancelled");
    },
    [cachedPasses]
  );

  // Get single cached pass
  const getCachedPass = useCallback(
    (bookingId: string): CachedBoardingPass | undefined => {
      return cachedPasses.find((p) => p.id === bookingId && p.status !== "cancelled");
    },
    [cachedPasses]
  );

  // Remove a pass (e.g. if cancelled)
  const removePass = useCallback((bookingId: string) => {
    if (typeof window === "undefined") return;
    try {
      const current = loadCachedPasses();
      const filtered = current.filter((p: CachedBoardingPass) => p.id !== bookingId);
      if (filtered.length === current.length) return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      setCachedPasses(filtered);
    } catch (e) {
      console.error("Failed to remove offline boarding pass:", e);
    }
  }, [loadCachedPasses]);

  return {
    cachedPasses,
    isOnline,
    isLoaded,
    loadCachedPasses,
    savePass,
    saveMultiplePasses,
    syncPasses,
    hasPass,
    getCachedPass,
    removePass,
  };
}
