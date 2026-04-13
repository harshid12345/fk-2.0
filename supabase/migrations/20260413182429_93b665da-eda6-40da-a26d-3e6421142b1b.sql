
-- Add viewing_slots column to landlord_properties
ALTER TABLE public.landlord_properties
ADD COLUMN IF NOT EXISTS viewing_slots jsonb DEFAULT '[]'::jsonb;

-- Create storage bucket for ID documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('id-documents', 'id-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Service role can insert (edge function uploads)
CREATE POLICY "Service role can upload ID documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'id-documents');

-- RLS: Landlords can view ID documents for their properties
CREATE POLICY "Landlords can view ID documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'id-documents'
  AND auth.role() = 'authenticated'
);
