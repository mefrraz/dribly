-- Create storage bucket for post template backgrounds
-- Run this in Supabase SQL Editor

-- 1. Create bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('post_templates', 'post_templates', true, 20971520, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 2. RLS: anyone can read (public bucket)
DROP POLICY IF EXISTS "Public read access post_templates" ON storage.objects;
CREATE POLICY "Public read access post_templates" ON storage.objects
    FOR SELECT USING (bucket_id = 'post_templates');

-- 3. RLS: authenticated users can upload
DROP POLICY IF EXISTS "Auth upload access post_templates" ON storage.objects;
CREATE POLICY "Auth upload access post_templates" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'post_templates'
        AND auth.role() = 'authenticated'
    );

-- 4. RLS: authenticated users can update/delete
DROP POLICY IF EXISTS "Auth update access post_templates" ON storage.objects;
CREATE POLICY "Auth update access post_templates" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'post_templates'
        AND auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "Auth delete access post_templates" ON storage.objects;
CREATE POLICY "Auth delete access post_templates" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'post_templates'
        AND auth.role() = 'authenticated'
    );
