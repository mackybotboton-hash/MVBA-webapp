import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";

/**
 * On-Demand Cache Revalidation API Route (ISR in Next.js 16)
 * Allows webhooks or admin/host actions to purge and refresh Edge CDN caches in < 20ms.
 *
 * Usage:
 * POST /api/revalidate?tag=properties&secret=YOUR_REVALIDATE_SECRET
 * POST /api/revalidate?path=/property/[id]&secret=YOUR_REVALIDATE_SECRET
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get("tag");
    const path = searchParams.get("path");
    const secret = searchParams.get("secret");

    const expectedSecret = process.env.REVALIDATION_SECRET;

    if (!expectedSecret) {
      return NextResponse.json(
        { success: false, message: "Server misconfiguration: REVALIDATION_SECRET is not configured." },
        { status: 500 }
      );
    }

    if (!secret || secret !== expectedSecret) {
      return NextResponse.json(
        { success: false, message: "Invalid or missing revalidation secret token." },
        { status: 401 }
      );
    }

    if (tag) {
      // In Next.js 16, revalidateTag accepts a second profile argument ('max' for stale-while-revalidate)
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

export async function GET(request: NextRequest) {
  return POST(request);
}
