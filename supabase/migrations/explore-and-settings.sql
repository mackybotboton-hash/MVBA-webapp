-- Create explore_islands table
CREATE TABLE IF NOT EXISTS public.explore_islands (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  tagline text NOT NULL,
  description text NOT NULL,
  features text[] NOT NULL DEFAULT '{}',
  image_url text NOT NULL,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for explore_islands
ALTER TABLE public.explore_islands ENABLE ROW LEVEL SECURITY;

-- Everyone can read active islands
CREATE POLICY "Anyone can view active explore islands" 
ON public.explore_islands FOR SELECT 
USING (is_active = true);

-- Admins can manage islands
CREATE POLICY "Admins can insert explore islands" 
ON public.explore_islands FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update explore islands" 
ON public.explore_islands FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete explore islands" 
ON public.explore_islands FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Seed explore_islands with initial data
INSERT INTO public.explore_islands (name, tagline, description, features, image_url, display_order) VALUES
('Boslon Island', 'The Iconic Sentinel of Bretania', 'The largest of the 24 islets, featuring imposing limestone rock formations, towering coconut palms, and a statue of the Virgin Mary facing the sea. At low tide, a natural sandbar connects Boslon to neighboring islets.', ARRAY['Limestone Clifftops', 'Shaded Rest Cottages', 'Tide Sandbar'], 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', 1),
('Naked Island', 'Pristine Pure White Sandbar', 'A completely bare, gleaming white sandbar surrounded by 360-degree crystal clear turquoise waters. Named ''Naked'' because it has no trees or foliage—just sun, sand, and ocean horizon.', ARRAY['Crystal Clear Water', 'Sandbar Strolls', 'Drone Photography'], 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=800&q=80', 2),
('Hagonoy Island', 'The Postcard Paradise', 'Half sandbar and half tropical coconut grove. It is famous for its pearly white beach and peaceful seaside atmosphere, making it a favorite spot for midday beach picnics and swimming.', ARRAY['Coconut Palm Groves', 'Fine Powder Sand', 'Swimming Lagoon'], 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=800&q=80', 3);


-- Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can view app settings" 
ON public.app_settings FOR SELECT 
USING (true);

-- Admins can update settings
CREATE POLICY "Admins can update app settings" 
ON public.app_settings FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can insert app settings" 
ON public.app_settings FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Seed app_settings with initial helpline data
INSERT INTO public.app_settings (key, value) VALUES
('helpline', '{"phone": "(+63) 912-345-6789", "description": "Need urgent assistance, weather updates, or boat coastguard verification? Contact the San Agustin Municipal Tourism Office at (+63) 912-345-6789."}'::jsonb);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_explore_islands ON public.explore_islands;
CREATE TRIGGER set_timestamp_explore_islands
BEFORE UPDATE ON public.explore_islands
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_app_settings ON public.app_settings;
CREATE TRIGGER set_timestamp_app_settings
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
