ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS google_maps_url text;
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_google_maps_url_check;
ALTER TABLE public.properties ADD CONSTRAINT properties_google_maps_url_check CHECK (google_maps_url IS NULL OR (char_length(google_maps_url) <= 500 AND google_maps_url ~* '^https://(maps\.app\.goo\.gl/|goo\.gl/maps/|(www\.)?google\.com/maps|maps\.google\.com/)'));
