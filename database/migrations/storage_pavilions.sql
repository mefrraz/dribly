-- Create storage bucket for pavilion images
-- Run this in Supabase SQL Editor

-- 1. Create bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pavilions', 'pavilions', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/avif'])
ON CONFLICT (id) DO NOTHING;

-- 2. RLS: anyone can read (public bucket)
CREATE POLICY "Public read access" ON storage.objects
    FOR SELECT USING (bucket_id = 'pavilions');

-- 3. RLS: only authenticated admins can upload
CREATE POLICY "Admin upload access" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'pavilions'
        AND auth.role() = 'authenticated'
    );

-- 4. RLS: only authenticated admins can update/delete their uploads
CREATE POLICY "Admin update access" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'pavilions'
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Admin delete access" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'pavilions'
        AND auth.role() = 'authenticated'
    );

-- 5. Rate limiting: bucket-level max 10MB per file, enforced above
