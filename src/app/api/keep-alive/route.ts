import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleKeepAlive(request);
}

export async function POST(request: Request) {
  return handleKeepAlive(request);
}

async function handleKeepAlive(request: Request) {
  const startTime = Date.now();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      {
        success: false,
        error: "Supabase credentials are not configured in environment variables.",
      },
      { status: 500 }
    );
  }

  // Optional: check CRON_SECRET for security if configured
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // If CRON_SECRET is set but doesn't match, return 401
    const { searchParams } = new URL(request.url);
    const secretQuery = searchParams.get("secret");
    if (secretQuery !== cronSecret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized request" },
        { status: 401 }
      );
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    let operation = "table_write_and_delete";
    let details: Record<string, unknown> = {};

    // 1. Try calling the RPC function ping_and_cleanup if it exists
    const { data: rpcData, error: rpcError } = await supabase.rpc("ping_and_cleanup");

    if (!rpcError && rpcData) {
      operation = "rpc_ping_and_cleanup";
      details = rpcData as Record<string, unknown>;
    } else {
      // 2. If RPC is not created, do direct insert & delete in _keep_alive table
      const { data: insertData, error: insertError } = await supabase
        .from("_keep_alive")
        .insert({
          ping_source: "api_keep_alive",
          metadata: { user_agent: request.headers.get("user-agent") || "unknown" },
        })
        .select("id")
        .single();

      if (!insertError && insertData) {
        // Immediately delete the inserted record so no data accumulates
        await supabase.from("_keep_alive").delete().eq("id", insertData.id);
        details = { insertedId: insertData.id, deleted: true };
      } else {
        // 3. Fallback to read query on profiles table if _keep_alive table is not yet migrated
        operation = "fallback_read_query";
        const { error: readError } = await supabase
          .from("profiles")
          .select("id")
          .limit(1);

        if (readError) {
          throw new Error(
            `Supabase Ping Failed: ${insertError?.message || readError.message}`
          );
        }
        details = { fallback: "profiles_table_ping_successful" };
      }
    }

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: "Supabase keep-alive ping executed successfully. Project is active!",
      operation,
      durationMs: `${durationMs}ms`,
      timestamp: new Date().toISOString(),
      details,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to communicate with Supabase",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
