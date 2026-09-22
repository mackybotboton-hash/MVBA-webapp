import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string = "") {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

export function formatCurrency(amount: number = 0): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Validates and sanitizes redirect paths to prevent Open Redirect vulnerabilities.
 * Ensures the target is a relative path starting with a single '/' and not '//', '/\', or scheme URI.
 */
export function getSafeRedirectUrl(target: string | null | undefined, fallback: string = "/"): string {
  if (!target || typeof target !== "string") return fallback;
  const trimmed = target.trim();
  // Reject protocol-relative URLs (e.g. //attacker.com) or backslash evasion (/\\attacker.com)
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.startsWith("\\")) {
    return fallback;
  }
  // Must be an internal relative path starting with '/'
  if (trimmed.startsWith("/")) {
    // Also guard against control characters
    if (/[\r\n\t\0]/.test(trimmed)) return fallback;
    return trimmed;
  }
  return fallback;
}

