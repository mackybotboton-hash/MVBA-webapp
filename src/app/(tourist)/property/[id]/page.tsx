import { Metadata, ResolvingMetadata } from "next";
import { createClient } from "@supabase/supabase-js";
import PropertyClient from "./property-client";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(
  { params }: Props,
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const resolvedParams = await params;
  const propertyId = resolvedParams?.id;

  if (!propertyId) {
    return {
      title: "Stay Details | MVBA",
      description: "Explore accredited homestays and resorts in Bretania, San Agustin.",
    };
  }

  // Initialize Supabase with anon key
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    const { data: property } = await supabase
      .from("properties")
      .select("name, description, address, cover_image_url")
      .eq("id", propertyId)
      .maybeSingle();

    if (!property) {
      return {
        title: "Stay Details | MVBA",
        description: "Explore accredited homestays and resorts in Bretania, San Agustin.",
      };
    }

    const title = `${property.name} | Bretania Stays | MVBA`;
    const description = property.description
      ? property.description.substring(0, 160) + "..."
      : `Book your accredited stay at ${property.name} in Bretania, San Agustin, Surigao del Sur.`;
    const imageUrl = property.cover_image_url || "/placeholder-image.jpg";

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://mvba-webapp.vercel.app/property/${propertyId}`,
        siteName: "MVBA San Agustin",
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: property.name,
          },
        ],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [imageUrl],
      },
    };
  } catch (_error) {
    return {
      title: "Stay Details | MVBA",
      description: "Explore accredited homestays and resorts in Bretania, San Agustin.",
    };
  }
}

export default function Page() {
  return <PropertyClient />;
}
