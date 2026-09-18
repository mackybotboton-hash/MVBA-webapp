import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// Create a singleton Supabase admin client for server-side isolated contexts ONLY.
// CAUTION: This client bypasses RLS policies. It must NEVER be exported to a Client Component
// or used in an unauthenticated context without manual verification.
export const createAdminClient = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Ensure this is only run on the server.");
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    }
  );
};
