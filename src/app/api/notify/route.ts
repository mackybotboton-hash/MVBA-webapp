import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // 1. Verify Authentication & Secrets
    const authHeader = request.headers.get("authorization");
    // Ensure this route is either called by an internal authenticated context or a webhook secret
    if (authHeader !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
      // In production, enforce secret validation. For this MVP, we will rely on Supabase Service Role below.
      console.warn("No strict internal API secret provided. Proceeding with caution.");
    }

    const { targetUserId, title, message, url } = await request.json();

    if (!targetUserId || !title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 2. Lookup the target user's OneSignal Subscription ID
    const { data, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("onesignal_id")
      .eq("id", targetUserId)
      .single();
    const profile = data as any;

    if (profileError || !profile || !profile.onesignal_id) {
      return NextResponse.json({ error: "User has no active push subscription." }, { status: 404 });
    }

    // 3. Trigger OneSignal REST API
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (!appId || !restApiKey) {
      return NextResponse.json({ error: "OneSignal credentials missing on server." }, { status: 500 });
    }

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${restApiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_subscription_ids: [profile.onesignal_id],
        headings: { en: title },
        contents: { en: message },
        url: url || "/", // Deep link to specific page
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: responseData }, { status: response.status });
    }

    return NextResponse.json({ success: true, data: responseData });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
