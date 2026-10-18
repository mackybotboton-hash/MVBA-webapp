import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const propertyId = resolvedParams?.id;

    if (!propertyId) {
      return getFallbackImage();
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return getFallbackImage();
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: property, error } = await supabase
      .from("properties")
      .select("id, name, cover_image_url")
      .eq("id", propertyId)
      .maybeSingle();

    if (error || !property || !property.cover_image_url) {
      return getFallbackImage();
    }

    const coverUrl = property.cover_image_url.trim();

    // Fetch the cover image (whether from Supabase Storage or external CDN)
    const imageRes = await fetch(coverUrl, {
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "Panaw-OG-Fetcher/1.0",
      },
      next: { revalidate: 3600 },
    });

    if (!imageRes.ok) {
      return getFallbackImage();
    }

    const imageBuffer = await imageRes.arrayBuffer();
    const contentType =
      imageRes.headers.get("content-type") || "image/jpeg";

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(imageBuffer.byteLength),
        "Cache-Control":
          "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Error serving property OG image:", err);
    return getFallbackImage();
  }
}

function getFallbackImage() {
  try {
    const fallbackPath = path.join(
      process.cwd(),
      "public",
      "icons",
      "icon-512.png"
    );
    if (fs.existsSync(fallbackPath)) {
      const fileBuffer = fs.readFileSync(fallbackPath);
      return new Response(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Content-Length": String(fileBuffer.length),
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  } catch {}

  return new Response(null, { status: 404 });
}
