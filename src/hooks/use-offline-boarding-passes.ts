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
      return Array.isArray(parsed) ? parsed : [];
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
      const current = loadCachedPasses();
      const existingIdx = current.findIndex((p: CachedBoardingPass) => p.id === pass.id);
      const newEntry: CachedBoardingPass = {
        ...pass,
        cached_at: new Date().toISOString(),
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

      // Populate existing
      current.forEach((p: CachedBoardingPass) => passMap.set(p.id, p));

      // Merge new confirmed passes
      const now = new Date().toISOString();
      passes.forEach((p) => {
        passMap.set(p.id, {
          ...p,
          cached_at: passMap.get(p.id)?.cached_at || now,
        });
      });

      const updated = Array.from(passMap.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setCachedPasses(updated);
    } catch (e) {
      console.error("Failed to batch save offline boarding passes:", e);
    }
  }, [loadCachedPasses]);

  // Check if a booking is cached
  const hasPass = useCallback(
    (bookingId: string) => {
      return cachedPasses.some((p) => p.id === bookingId);
    },
    [cachedPasses]
  );

  // Get single cached pass
  const getCachedPass = useCallback(
    (bookingId: string): CachedBoardingPass | undefined => {
      return cachedPasses.find((p) => p.id === bookingId);
    },
    [cachedPasses]
  );

  // Remove a pass (e.g. if cancelled)
  const removePass = useCallback((bookingId: string) => {
    if (typeof window === "undefined") return;
    try {
      const current = loadCachedPasses();
      const filtered = current.filter((p: CachedBoardingPass) => p.id !== bookingId);
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
    savePass,
    saveMultiplePasses,
    hasPass,
    getCachedPass,
    removePass,
  };
}
