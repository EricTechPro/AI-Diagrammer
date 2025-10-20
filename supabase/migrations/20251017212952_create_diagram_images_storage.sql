/*
  # Create Storage Bucket for Diagram Images

  1. New Storage Bucket
    - `diagram-images` bucket for storing user-uploaded images
    - Public access for reading images
    - Authenticated users can upload

  2. Security Policies
    - Authenticated users can upload images
    - Public read access for displaying images
    - Users can only delete their own images
*/

-- Create storage bucket for diagram images
INSERT INTO storage.buckets (id, name, public)
VALUES ('diagram-images', 'diagram-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'diagram-images');

-- Allow public read access
CREATE POLICY "Public read access for images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'diagram-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete own images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'diagram-images' AND owner::text = auth.uid()::text);
