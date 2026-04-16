ALTER TABLE public.landlord_properties
  ADD COLUMN IF NOT EXISTS tenant_phone text,
  ADD COLUMN IF NOT EXISTS tenant_email text,
  ADD COLUMN IF NOT EXISTS tenant_telegram_user_id text,
  ADD COLUMN IF NOT EXISTS tenant_telegram_chat_id bigint;

CREATE INDEX IF NOT EXISTS idx_landlord_properties_tenant_telegram_user_id
  ON public.landlord_properties (tenant_telegram_user_id)
  WHERE tenant_telegram_user_id IS NOT NULL;