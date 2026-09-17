import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  console.log("Registering superadmin@sarah.test...");
  const { data, error } = await supabase.auth.signUp({
    email: 'superadmin@sarah.test',
    password: 'password123',
    options: {
      data: {
        full_name: 'Super Admin',
        role: 'admin',
        phone_number: '123456789'
      }
    }
  });
  
  if (error) {
    console.error("SignUp Error:", error);
  } else {
    console.log("SignUp Success! User:", data.user?.id);
  }
}

createAdmin();
