ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_google_maps_url_check;
ALTER TABLE public.properties DROP COLUMN IF EXISTS google_maps_url;
