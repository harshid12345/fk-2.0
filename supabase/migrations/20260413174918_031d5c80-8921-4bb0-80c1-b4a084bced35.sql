
CREATE TABLE public.tenant_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL,
  tenant_name TEXT,
  telegram_user_id TEXT,
  message TEXT NOT NULL,
  photo_url TEXT,
  category TEXT NOT NULL DEFAULT 'needs_attention',
  ai_response TEXT,
  ai_resolved BOOLEAN DEFAULT FALSE,
  landlord_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT tenant_issues_category_check CHECK (category IN ('trivial','needs_attention','urgent'))
);

ALTER TABLE public.tenant_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords can view issues for own properties"
ON public.tenant_issues
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM landlord_properties
  WHERE landlord_properties.id = tenant_issues.property_id
  AND landlord_properties.landlord_id = auth.uid()
));

CREATE POLICY "Landlords can update issues for own properties"
ON public.tenant_issues
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM landlord_properties
  WHERE landlord_properties.id = tenant_issues.property_id
  AND landlord_properties.landlord_id = auth.uid()
));

CREATE POLICY "Landlords can insert issues for own properties"
ON public.tenant_issues
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM landlord_properties
  WHERE landlord_properties.id = tenant_issues.property_id
  AND landlord_properties.landlord_id = auth.uid()
));
