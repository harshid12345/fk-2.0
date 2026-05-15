ALTER TABLE public.tenant_issues
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;
