const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const propertyId = '2601c009-13a3-45a7-9a86-fae335500b6a';

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .limit(1);

  if (error) {
    console.error("ERROR querying reviews:", error.message, error.details, error.hint);
  } else {
    console.log("SUCCESS querying reviews:", data);
  }
}

test();
