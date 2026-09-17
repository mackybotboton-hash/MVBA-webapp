import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";

// Load .env.local
const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  console.log("Fetching users from auth.users...");
  // Note: we can't fetch auth.users easily without service role key,
  // but we can fetch profiles!
  
  console.log("Fetching all profiles from public.profiles...");
  const { data: profiles, error } = await supabase.from("profiles").select("*");
  if (error) {
    console.error("Error fetching profiles:", error);
  } else {
    console.log(`Found ${profiles?.length || 0} profiles:`);
    console.log(JSON.stringify(profiles, null, 2));
  }
}

main();
