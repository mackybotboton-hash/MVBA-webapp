"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";

const WISHLIST_STORAGE_KEY = "mvba_saved_properties";
const WISHLIST_EVENT_NAME = "mvba-wishlist-updated";

export function useWishlist() {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(WISHLIST_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedIds(parsed);
        }
      } else {
        setSavedIds([]);
      }
    } catch {
      setSavedIds([]);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadFromStorage();

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === WISHLIST_STORAGE_KEY) {
        loadFromStorage();
      }
    };

    const handleCustomEvent = () => {
      loadFromStorage();
    };

    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener(WISHLIST_EVENT_NAME, handleCustomEvent);

    return () => {
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener(WISHLIST_EVENT_NAME, handleCustomEvent);
    };
  }, [loadFromStorage]);

  const isSaved = useCallback(
    (propertyId: string) => {
      return savedIds.includes(propertyId);
    },
    [savedIds]
  );

  const toggleSave = useCallback(
    (propertyId: string, propertyName?: string) => {
      try {
        const current = localStorage.getItem(WISHLIST_STORAGE_KEY);
        let list: string[] = current ? JSON.parse(current) : [];
        if (!Array.isArray(list)) list = [];

        const exists = list.includes(propertyId);
        let next: string[];

        if (exists) {
          next = list.filter((id) => id !== propertyId);
          toast.info("Removed from your wishlist", {
            description: propertyName ? `${propertyName} has been removed.` : undefined,
          });
        } else {
          next = [...list, propertyId];
          toast.success("Saved to your wishlist", {
            description: propertyName
              ? `${propertyName} is saved. View in your profile or wishlist.`
              : "You can view your saved stays in your profile wishlist.",
          });
        }

        localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(next));
        setSavedIds(next);
        window.dispatchEvent(new Event(WISHLIST_EVENT_NAME));
        return !exists;
      } catch {
        toast.error("Could not update wishlist");
        return false;
      }
    },
    []
  );

  const removeSave = useCallback((propertyId: string, propertyName?: string) => {
    try {
      const current = localStorage.getItem(WISHLIST_STORAGE_KEY);
      let list: string[] = current ? JSON.parse(current) : [];
      if (!Array.isArray(list)) list = [];

      const next = list.filter((id) => id !== propertyId);
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(next));
      setSavedIds(next);
      window.dispatchEvent(new Event(WISHLIST_EVENT_NAME));
      toast.info("Removed from your wishlist", {
        description: propertyName ? `${propertyName} removed.` : undefined,
      });
    } catch {
      toast.error("Could not remove property from wishlist");
    }
  }, []);

  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);

  return {
    savedIds,
    savedSet,
    count: savedIds.length,
    isLoaded,
    isSaved,
    toggleSave,
    removeSave,
  };
}
