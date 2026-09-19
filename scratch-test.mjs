import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eeotxaiqumokaafslypv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlb3R4YWlxdW1va2FhZnNseXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjMwMDMsImV4cCI6MjEwMzk5OTAwM30.E7cE_4tdoEBUHudXgik7pY0WIQVYz1z4GFp2-Pex8BQ'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('bookings').insert({
    check_in: '2026-09-20',
  }).select()
  console.log('Error check_in:', error)
}

test()
