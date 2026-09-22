-- Add payout and notification fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS payout_gcash_number TEXT,
ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS onesignal_id TEXT;

-- Update RLS policies to ensure admins can SELECT these fields
-- By default, profiles have "Profiles are viewable by everyone" so everyone (including admins) 
-- can already read these columns. We will explicitly define an admin SELECT policy 
-- in case the public policy is ever restricted in the future.

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'admin')
);

-- Users can already UPDATE their own profiles due to "Users can update own profile" policy.
