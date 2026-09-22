import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import crypto from "crypto";

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * On-Demand Cache Revalidation API Route (ISR in Next.js 16)
 * Allows authorized webhooks or admin actions to purge Edge CDN caches.
 *
 * Preferred:
 * POST /api/revalidate?tag=properties
 * Headers:
 *   Authorization: Bearer <YOUR_REVALIDATE_SECRET> OR x-revalidate-secret: <YOUR_REVALIDATE_SECRET>
 */
export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.REVALIDATION_SECRET;

    if (!expectedSecret) {
      return NextResponse.json(
        { success: false, message: "Server misconfiguration: REVALIDATION_SECRET is not configured." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tag = searchParams.get("tag");
    const path = searchParams.get("path");

    // Prefer secure header transmission over URL search params to avoid token logging in access logs
    const authHeader = request.headers.get("authorization");
    let providedSecret: string | null = request.headers.get("x-revalidate-secret");

    if (!providedSecret && authHeader && authHeader.startsWith("Bearer ")) {
      providedSecret = authHeader.slice(7).trim();
    }
    // Backward compatibility fallback: query param
    if (!providedSecret) {
      providedSecret = searchParams.get("secret");
    }

    if (!providedSecret || !safeCompare(providedSecret, expectedSecret)) {
      return NextResponse.json(
        { success: false, message: "Invalid or missing revalidation secret token." },
        { status: 401 }
      );
    }

    if (tag) {
      revalidateTag(tag, "max");
      return NextResponse.json({
        revalidated: true,
        type: "tag",
        tag,
        timestamp: new Date().toISOString(),
      });
    }

    if (path) {
      revalidatePath(path);
      return NextResponse.json({
        revalidated: true,
        type: "path",
        path,
        timestamp: new Date().toISOString(),
      });
    }

    // Default: purge properties tag and root path
    revalidateTag("properties", "max");
    revalidatePath("/");

    return NextResponse.json({
      revalidated: true,
      type: "all",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Revalidation failed" },
      { status: 500 }
    );
  }
}
