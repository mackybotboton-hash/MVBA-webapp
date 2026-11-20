/**
 * Resolves the canonical public origin of the site (no trailing slash).
 *
 * Priority:
 *   1. NEXT_PUBLIC_SITE_URL (set this in Vercel for production)
 *   2. VERCEL_PROJECT_PRODUCTION_URL (auto-provided by Vercel, host only)
 *   3. http://localhost:3000 (local development)
 *
 * Note: VERCEL_PROJECT_PRODUCTION_URL is server-only. In the browser, prefer
 * `window.location.origin` and use this helper only as a fallback.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return stripTrailingSlash(explicit);
  }

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelHost) {
    return `https://${stripTrailingSlash(vercelHost.replace(/^https?:\/\//, ""))}`;
  }

  return "http://localhost:3000";
}

/** Builds an absolute URL for a site-relative path using {@link getSiteUrl}. */
export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
