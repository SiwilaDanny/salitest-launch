-- ═══════════════════════════════════════════════════════════
-- SaLiTeSt Launch — App Icons Storage Setup
-- Run in Supabase SQL Editor to enable storage policies
-- ═══════════════════════════════════════════════════════════

-- Enable storage on the app-icons bucket
-- Note: Create the "app-icons" bucket in Supabase Dashboard first:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Create new bucket named "app-icons"
-- 3. Make it public
-- 4. Run this migration

-- Create storage policies for app-icons bucket
CREATE POLICY "Developers can upload app icons"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'app-icons'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Anyone can view app icons"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'app-icons');

CREATE POLICY "Developers can update own app icons"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'app-icons'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Developers can delete own app icons"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'app-icons'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
