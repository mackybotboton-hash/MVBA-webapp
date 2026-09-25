-- Create system_settings table with a singleton constraint
CREATE TABLE IF NOT EXISTS public.system_settings (
  id INT PRIMARY KEY CHECK (id = 1),
  commission_percentage NUMERIC NOT NULL DEFAULT 8.0,
  convenience_fee NUMERIC NOT NULL DEFAULT 100.0,
  admin_gcash_number TEXT NOT NULL DEFAULT '0917-000-0000',
  admin_gcash_name TEXT NOT NULL DEFAULT 'MVBA Admin',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert the default seed row
INSERT INTO public.system_settings (id, commission_percentage, convenience_fee, admin_gcash_number, admin_gcash_name)
VALUES (1, 8.0, 100.0, '0917-000-0000', 'MVBA Admin')
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- SELECT is public (everyone needs to read settings)
CREATE POLICY "System settings are viewable by everyone"
ON public.system_settings FOR SELECT USING (true);

-- UPDATE is restricted to admins only
CREATE POLICY "System settings can be updated by admins only"
ON public.system_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_system_settings_updated ON public.system_settings;
CREATE TRIGGER on_system_settings_updated
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_system_settings_updated_at();
