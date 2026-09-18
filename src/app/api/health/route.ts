import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabaseAdmin = createAdminClient();
    
    // Execute a simple query to verify database connectivity
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .limit(1);

    if (error) {
      console.error("[Health Check] Database connection failed:", error);
      return NextResponse.json(
        { status: "unhealthy", message: "Database connection failed", error: error.message },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { status: "healthy", message: "Application is running and database is connected" },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[Health Check] Critical error:", err);
    return NextResponse.json(
      { status: "unhealthy", message: "Internal Server Error", error: err.message },
      { status: 500 }
    );
  }
}
