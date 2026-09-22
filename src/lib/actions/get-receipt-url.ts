"use server";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// Use the service role key to bypass RLS for generating signed URLs of payment receipts
// This is necessary because the RLS policy for the payment-receipts bucket
// restricts access based on folder names matching user IDs, but receipts
// are currently uploaded to the root of the bucket.
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getSignedReceiptUrl(storagePath: string) {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from("payment-receipts")
      .createSignedUrl(storagePath, 3600);

    if (error) {
      console.error("Failed to generate signed URL for receipt:", error);
      return null;
    }

    return data?.signedUrl || null;
  } catch (error) {
    console.error("Exception generating signed URL:", error);
    return null;
  }
}
