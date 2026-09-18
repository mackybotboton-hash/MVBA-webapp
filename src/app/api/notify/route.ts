import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    // 1. Enforce Authorization: Either valid Bearer token matching INTERNAL_API_SECRET
    // or an authenticated session from an active user
    const authHeader = request.headers.get("authorization");
    const internalSecret = process.env.INTERNAL_API_SECRET;
    let isAuthorized = false;

    if (internalSecret && authHeader === `Bearer ${internalSecret}`) {
      isAuthorized = true;
    } else {
      const supabaseUser = await createClient();
      const {
        data: { user },
      } = await supabaseUser.auth.getUser();
      if (user) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing authorization credentials." },
        { status: 401 }
      );
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
        url: url || "/",
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: responseData }, { status: response.status });
    }

    return NextResponse.json({ success: true, data: responseData });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to process notification" }, { status: 500 });
  }
}
