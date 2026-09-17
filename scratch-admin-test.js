import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// We must use SERVICE ROLE to query auth.users if we want to bypass RLS or see metadata.
// But we don't have service_role in .env.local natively for client, only SUPABASE_SERVICE_ROLE_KEY if we added it.
// Let's just query profiles table as anon to see what role admin@sarah.test has.
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Checking admin profile...");
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", "admin@sarah.test") // Assuming email is on profiles table? Wait, email is usually in auth.users.
    .limit(1);
    
  console.log("Result:", JSON.stringify(data, null, 2));
  console.log("Error:", error);
}

test();
