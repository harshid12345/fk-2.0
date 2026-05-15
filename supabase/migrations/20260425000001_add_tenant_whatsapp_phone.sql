ALTER TABLE public.landlord_properties
  ADD COLUMN IF NOT EXISTS tenant_whatsapp_phone text;

CREATE INDEX IF NOT EXISTS idx_landlord_properties_tenant_whatsapp_phone
  ON public.landlord_properties (tenant_whatsapp_phone)
  WHERE tenant_whatsapp_phone IS NOT NULL;
