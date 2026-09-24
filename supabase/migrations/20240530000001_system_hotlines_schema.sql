CREATE TABLE public.system_hotlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    number TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.system_hotlines ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read hotlines
CREATE POLICY "Anyone can read system_hotlines"
    ON public.system_hotlines
    FOR SELECT
    USING (true);

-- Allow admins to manage hotlines
CREATE POLICY "Admins can manage system_hotlines"
    ON public.system_hotlines
    FOR ALL
    USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- Seed data
INSERT INTO public.system_hotlines (name, description, number, display_order) VALUES
('San Agustin MDRRMO (Disaster & Rescue)', '24/7 Sea rescue, emergency medical, and weather alerts', '09985551234', 1),
('San Agustin Municipal Police Station (PNP)', 'Public safety, assistance, and reporting', '09985986371', 2),
('Philippine Coast Guard (PCG) Lianga Bay', 'Maritime safety and vessel dispatch clearances', '09177245489', 3),
('San Agustin Municipal Tourism Office', 'Accreditation inquiries and tourist assistance', '09123456789', 4);
