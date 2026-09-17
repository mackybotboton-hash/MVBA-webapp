import { Metadata, ResolvingMetadata } from "next";
import { createClient } from "@supabase/supabase-js";
import PropertyClient from "./property-client";

type Props = {
  params: { id: string };
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const propertyId = params.id;

  // Initialize Supabase with service role or anon key
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    const { data: property } = await supabase
      .from("properties")
      .select("name, description, cover_image_url")
      .eq("id", propertyId)
      .single();

    if (!property) {
      return {
        title: "Property Not Found | MVBA",
        description: "The property you are looking for does not exist.",
      };
    }

    const title = `Stay at ${property.name} | Bretania`;
    const description = property.description
      ? property.description.substring(0, 160) + "..."
      : "Book your perfect stay in Bretania today.";
    const imageUrl = property.cover_image_url || "/placeholder-image.jpg";

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://mvba.app/property/${propertyId}`,
        siteName: "MVBA",
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
  } catch (error) {
    return {
      title: "Property | MVBA",
    };
  }
}

export default function Page() {
  return <PropertyClient />;
}
