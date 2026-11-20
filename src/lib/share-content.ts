import type { Property, PropertyType } from "@/lib/types/database";

/**
 * Single source of truth for all Panaw share / link-preview wording.
 * Edit the copy here; the share button and page metadata both read from it.
 */

const PROVINCE = "Surigao del Sur";
const DEFAULT_LOCATION = `Bretania, San Agustin, ${PROVINCE}`;
const BRAND = "Panaw";

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  homestay: "Homestay",
  resort: "Resort",
};

/** Minimal property fields needed to build share text and metadata. */
export type ShareableProperty = Pick<Property, "id" | "name" | "type"> &
  Partial<Pick<Property, "address">>;

export interface ShareContent {
  title: string;
  text: string;
  url: string;
  /** Text + newline + URL, for clipboard / plain-text channels. */
  clipboardText: string;
}

/** Public path of a stay detail page. */
export function getPropertyPath(propertyId: string): string {
  return `/property/${propertyId}`;
}

/** "Homestay" / "Resort"; falls back to "Stay" for unknown types. */
export function formatPropertyType(type: PropertyType | string | null | undefined): string {
  if (type && type in PROPERTY_TYPE_LABELS) {
    return PROPERTY_TYPE_LABELS[type as PropertyType];
  }
  return "Stay";
}

/**
 * Uses the free-text address as-is (normalising stray/empty comma segments),
 * appending the province only when it's missing. Empty → default location.
 */
export function formatPropertyLocation(address: string | null | undefined): string {
  const cleaned = (address ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

  if (!cleaned) return DEFAULT_LOCATION;
  return cleaned.toLowerCase().includes(PROVINCE.toLowerCase())
    ? cleaned
    : `${cleaned}, ${PROVINCE}`;
}

/**
 * Builds the native-share / clipboard payload for a stay.
 * `origin` should be `window.location.origin` on the client.
 *
 * TODO: append " ✅ Panaw Verified" to line 1 once properties have a real
 * verification flag (e.g. an `is_verified` column).
 */
export function buildShareContent(property: ShareableProperty, origin: string): ShareContent {
  const name = property.name?.trim() || "this stay";
  const url = `${origin.replace(/\/+$/, "")}${getPropertyPath(property.id)}`;

  const text = [
    name,
    `${formatPropertyType(property.type)} in ${formatPropertyLocation(property.address)}`,
    `See rooms and rates, and book directly on ${BRAND}:`,
  ].join("\n");

  return {
    title: `${name} | ${BRAND}`,
    text,
    url,
    clipboardText: `${text}\n${url}`,
  };
}

/** Page <title> / og:title for a stay. */
export function buildMetadataTitle(property: Pick<ShareableProperty, "name">): string {
  return `${property.name?.trim() || "Stay Details"} | ${BRAND}`;
}

/** Meta / og:description for a stay. */
export function buildMetadataDescription(
  property: Pick<ShareableProperty, "type" | "address">
): string {
  return `${formatPropertyType(property.type)} in ${formatPropertyLocation(
    property.address
  )}. See rooms, rates, and book on ${BRAND}.`;
}
