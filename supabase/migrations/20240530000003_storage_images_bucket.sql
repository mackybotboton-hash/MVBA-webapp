-- Create a public bucket for images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to images
CREATE POLICY "Public Read Access on Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

-- Allow authenticated admins to upload images
CREATE POLICY "Admins can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'images' 
    AND auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);

-- Allow authenticated admins to update/delete images
CREATE POLICY "Admins can manage images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'images' 
    AND auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);
CREATE POLICY "Admins can delete images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'images' 
    AND auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);
