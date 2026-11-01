/**
 * Shared Google Maps URL validator for property location.
 * Enforces security, character limit, and exact parity with database CHECK constraint:
 * properties_google_maps_url_check
 */

export type ValidateMapsUrlResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

const POSTGRES_MAPS_REGEX = /^https:\/\/(maps\.app\.goo\.gl\/|goo\.gl\/maps\/|(www\.)?google\.com\/maps|maps\.google\.com\/)/i;

/**
 * Validates a Google Maps share link.
 *
 * Rules:
 * - Empty/null/undefined is treated as valid (optional field, returns null).
 * - Maximum 500 characters.
 * - Must be a valid URL with https: protocol.
 * - Hostname and path must match supported Google Maps share domains:
 *   - maps.app.goo.gl
 *   - goo.gl (path starts with /maps)
 *   - google.com or www.google.com (path starts with /maps)
 *   - maps.google.com
 */
export function validateMapsUrl(input: unknown): ValidateMapsUrlResult {
  if (input === null || input === undefined) {
    return { ok: true, value: null };
  }

  const trimmed = String(input).trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }

  if (trimmed.length > 500) {
    return {
      ok: false,
      error: "Google Maps link is too long (max 500 characters). / Masyadong mahaba ang Google Maps link (hanggang 500 characters lamang).",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      error: "Please enter a valid web link (e.g., https://maps.app.goo.gl/...). / Mag-paste ng wastong web link.",
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      error: "Google Maps link must use https://. / Kailangang magsimula sa https:// ang Google Maps link.",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;

  const isMapsAppGooGl = hostname === "maps.app.goo.gl";
  const isGooGlMaps = hostname === "goo.gl" && pathname.startsWith("/maps");
  const isGoogleComMaps = (hostname === "google.com" || hostname === "www.google.com") && pathname.startsWith("/maps");
  const isMapsGoogleCom = hostname === "maps.google.com";

  if (!isMapsAppGooGl && !isGooGlMaps && !isGoogleComMaps && !isMapsGoogleCom) {
    return {
      ok: false,
      error: "Paste a Google Maps share link (maps.app.goo.gl or google.com/maps). / Mag-paste ng Google Maps share link.",
    };
  }

  // Double-check against SQL constraint pattern for 100% DB alignment
  if (!POSTGRES_MAPS_REGEX.test(trimmed)) {
    return {
      ok: false,
      error: "Paste a Google Maps share link (maps.app.goo.gl or google.com/maps). / Mag-paste ng Google Maps share link.",
    };
  }

  return { ok: true, value: trimmed };
}
