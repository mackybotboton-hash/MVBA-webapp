import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load environment variables from .env.local or .env if present
const envFiles = [".env.local", ".env"];
for (const file of envFiles) {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf-8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valParts] = trimmed.split("=");
        if (key && valParts.length > 0) {
          const val = valParts.join("=").replace(/^["']|["']$/g, "").trim();
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = val;
          }
        }
      }
    });
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: Missing Supabase URL or Anon Key in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log("⏳ Sending Keep-Alive Ping to Supabase...");
  const startTime = Date.now();

  try {
    // 1. Try RPC function
    const { data: rpcData, error: rpcError } = await supabase.rpc("ping_and_cleanup");
    if (!rpcError && rpcData) {
      console.log("✅ Success via RPC:", rpcData);
      console.log(`⏱️ Duration: ${Date.now() - startTime}ms`);
      return;
    }

    // 2. Try inserting and immediately deleting from _keep_alive
    const { data: insertData, error: insertError } = await supabase
      .from("_keep_alive")
      .insert({
        ping_source: "cli_script",
        metadata: { timestamp: new Date().toISOString() },
      })
      .select("id")
      .single();

    if (!insertError && insertData) {
      await supabase.from("_keep_alive").delete().eq("id", insertData.id);
      console.log("✅ Heartbeat inserted and cleaned up immediately from '_keep_alive' table!");
      console.log(`⏱️ Duration: ${Date.now() - startTime}ms`);
      return;
    }

    // 3. Fallback read query
    const { data, error: readError } = await supabase.from("profiles").select("id").limit(1);
    if (readError) {
      throw readError;
    }

    console.log("✅ Ping successful via fallback query (profiles table)!");
    console.log(`⏱️ Duration: ${Date.now() - startTime}ms`);
  } catch (err) {
    console.error("❌ Keep-Alive Ping Failed:", err.message || err);
    process.exit(1);
  }
}

main();
