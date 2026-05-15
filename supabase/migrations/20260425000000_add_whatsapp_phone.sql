ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS whatsapp_phone text;

CREATE INDEX IF NOT EXISTS idx_applicants_whatsapp_phone
  ON public.applicants (whatsapp_phone)
  WHERE whatsapp_phone IS NOT NULL;
