CREATE TABLE public.explore_islands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tagline TEXT,
    description TEXT,
    image_url TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.explore_islands ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read islands
CREATE POLICY "Anyone can read explore_islands"
    ON public.explore_islands
    FOR SELECT
    USING (true);

-- Allow admins to manage islands
CREATE POLICY "Admins can manage explore_islands"
    ON public.explore_islands
    FOR ALL
    USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- Seed data
INSERT INTO public.explore_islands (name, tagline, description, image_url, display_order) VALUES
('Naked Island', 'The Bare Beauty', 'A stunning 200-meter white sandbar surrounded by crystal clear waters. Perfect for swimming and sunbathing. No trees, no cottages, just pure sand and sea.', 'https://images.unsplash.com/photo-1590059124233-0c4a457497d3?auto=format&fit=crop&q=80&w=1000', 1),
('Boslon Island', 'The Main Attraction', 'The largest and most popular island in the group. Features a cross, limestone rock formations, and is the usual stop for the seafood boodle fight lunch.', 'https://images.unsplash.com/photo-1544376798-89aa6b82c6cd?auto=format&fit=crop&q=80&w=1000', 2),
('Hagonoy Island', 'The C-Shaped Wonder', 'Known for its unique C-shape and agoho trees (similar to pine trees). It offers a long stretch of white sand and is great for relaxation.', 'https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?auto=format&fit=crop&q=80&w=1000', 3),
('Panlangagan Islet', 'The Twin Islets', 'Features a small cave and beautiful rock formations. During low tide, you can walk between the twin islets.', 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&q=80&w=1000', 4);
