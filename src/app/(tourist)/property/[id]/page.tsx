import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import PropertyClient from "./property-client";
import type { Property } from "@/lib/types/database";
import { absoluteUrl, getSiteUrl } from "@/lib/site-url";
import {
  buildMetadataDescription,
  buildMetadataTitle,
  getPropertyPath,
} from "@/lib/share-content";

type Props = {
  params: Promise<{ id: string }>;
};

type PropertyMetadataRow = Pick<Property, "name" | "type" | "address" | "cover_image_url" | "updated_at">;

const FALLBACK_METADATA: Metadata = {
  title: "Stay Details | Panaw",
  description: "Explore accredited homestays and resorts in Bretania, San Agustin, Surigao del Sur.",
};

// Default image until a proper 1200x630 Panaw OG image is added to /public.
const DEFAULT_OG_IMAGE_PATH = "/icons/icon-512.png";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const propertyId = resolvedParams?.id;

  if (!propertyId) {
    return FALLBACK_METADATA;
  }

  // Initialize Supabase with anon key
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    const { data: property } = await supabase
      .from("properties")
      .select("name, type, address, cover_image_url, updated_at")
      .eq("id", propertyId)
      .maybeSingle<PropertyMetadataRow>();

    if (!property) {
      return FALLBACK_METADATA;
    }

    const title = buildMetadataTitle(property);
    const description = buildMetadataDescription(property);
    const pageUrl = absoluteUrl(getPropertyPath(propertyId));
    const hasCover = Boolean(property.cover_image_url?.trim());

    const timestamp = property.updated_at
      ? new Date(property.updated_at).getTime()
      : Date.now();
    const proxyImageUrl = absoluteUrl(`/api/property/${propertyId}/og-image?v=${timestamp}`);
    const defaultImageUrl = absoluteUrl(DEFAULT_OG_IMAGE_PATH);

    const ogImages = hasCover
      ? [
          {
            url: proxyImageUrl,
            secureUrl: proxyImageUrl,
            width: 1200,
            height: 630,
            alt: property.name,
          },
          {
            url: property.cover_image_url!.trim(),
            secureUrl: property.cover_image_url!.trim(),
            alt: property.name,
          },
        ]
      : [
          {
            url: defaultImageUrl,
            secureUrl: defaultImageUrl,
            width: 512,
            height: 512,
            alt: "Panaw",
          },
        ];

    return {
      metadataBase: new URL(getSiteUrl()),
      title,
      description,
      alternates: { canonical: pageUrl },
      openGraph: {
        title,
        description,
        url: pageUrl,
        siteName: "Panaw",
        images: ogImages,
        type: "website",
      },
      twitter: {
        // Square fallback icon renders poorly as a large card, so only use
        // summary_large_image when the property has a real cover photo.
        card: hasCover ? "summary_large_image" : "summary",
        title,
        description,
        images: [hasCover ? proxyImageUrl : defaultImageUrl],
      },
    };
  } catch {
    return FALLBACK_METADATA;
  }
}

import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PropertyClient />
    </Suspense>
  );
}
