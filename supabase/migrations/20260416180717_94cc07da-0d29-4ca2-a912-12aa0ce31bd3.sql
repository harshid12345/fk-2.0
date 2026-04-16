-- 1. Add knowledge base columns to landlord_properties
ALTER TABLE public.landlord_properties
  ADD COLUMN IF NOT EXISTS knowledge_base_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS knowledge_base_text text;

-- 2. Create private storage bucket for property documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-docs', 'property-docs', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies: files are stored under {landlord_id}/{property_id}/{filename}
-- Landlords can manage only files in their own folder.

DROP POLICY IF EXISTS "Landlords can read own property docs" ON storage.objects;
CREATE POLICY "Landlords can read own property docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'property-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Landlords can upload own property docs" ON storage.objects;
CREATE POLICY "Landlords can upload own property docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'property-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Landlords can update own property docs" ON storage.objects;
CREATE POLICY "Landlords can update own property docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'property-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Landlords can delete own property docs" ON storage.objects;
CREATE POLICY "Landlords can delete own property docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'property-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);