import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Fetching properties WITH ROOMS without auth...");
  const { data, error } = await supabase
    .from("properties")
    .select(`
      id,
      name,
      rooms (
        base_price,
        max_capacity
      )
    `)
    .eq("status", "active");
  console.log("Data:", JSON.stringify(data, null, 2));
  console.log("Error:", error);
}

test();
