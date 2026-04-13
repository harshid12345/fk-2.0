
-- Create landlords table
CREATE TABLE public.landlords (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  portfolio_size TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.landlords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords can view own profile" ON public.landlords FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Landlords can insert own profile" ON public.landlords FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Landlords can update own profile" ON public.landlords FOR UPDATE USING (auth.uid() = id);

-- Create landlord_properties table
CREATE TABLE public.landlord_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.landlords(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  postcode TEXT,
  city TEXT,
  surface_m2 NUMERIC,
  building_year INT,
  energy_label TEXT,
  rent_amount NUMERIC,
  property_type TEXT,
  accommodation_type TEXT CHECK (accommodation_type IN ('independent','shared')),
  wws_points NUMERIC,
  wws_max_rent NUMERIC,
  wws_compliant BOOLEAN,
  bag_verified BOOLEAN DEFAULT FALSE,
  tenant_name TEXT,
  tenant_contract_start DATE,
  tenant_monthly_rent NUMERIC,
  tenant_deposit NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.landlord_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords can view own properties" ON public.landlord_properties FOR SELECT USING (auth.uid() = landlord_id);
CREATE POLICY "Landlords can insert own properties" ON public.landlord_properties FOR INSERT WITH CHECK (auth.uid() = landlord_id);
CREATE POLICY "Landlords can update own properties" ON public.landlord_properties FOR UPDATE USING (auth.uid() = landlord_id);
CREATE POLICY "Landlords can delete own properties" ON public.landlord_properties FOR DELETE USING (auth.uid() = landlord_id);

-- Create landlord_criteria table
CREATE TABLE public.landlord_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.landlord_properties(id) ON DELETE CASCADE,
  preferred_gender TEXT,
  min_age INT,
  max_age INT,
  smoking_allowed BOOLEAN,
  pets_allowed BOOLEAN,
  students_ok BOOLEAN,
  professionals_ok BOOLEAN,
  min_income_multiplier NUMERIC DEFAULT 3.0,
  notes TEXT
);

ALTER TABLE public.landlord_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords can view own criteria" ON public.landlord_criteria FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.landlord_properties WHERE id = property_id AND landlord_id = auth.uid())
);
CREATE POLICY "Landlords can insert own criteria" ON public.landlord_criteria FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.landlord_properties WHERE id = property_id AND landlord_id = auth.uid())
);
CREATE POLICY "Landlords can update own criteria" ON public.landlord_criteria FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.landlord_properties WHERE id = property_id AND landlord_id = auth.uid())
);
CREATE POLICY "Landlords can delete own criteria" ON public.landlord_criteria FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.landlord_properties WHERE id = property_id AND landlord_id = auth.uid())
);

-- Create applicants table
CREATE TABLE public.applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.landlord_properties(id) ON DELETE CASCADE,
  telegram_user_id TEXT,
  full_name TEXT,
  age INT,
  gender TEXT,
  phone TEXT,
  email TEXT,
  occupation TEXT,
  monthly_income NUMERIC,
  id_verified BOOLEAN DEFAULT FALSE,
  id_document_url TEXT,
  lifestyle_answers JSONB,
  social_handle TEXT,
  social_scrape_data JSONB,
  match_score INT,
  match_flags JSONB,
  viewing_booked_at TIMESTAMPTZ,
  stage TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords can view applicants for own properties" ON public.applicants FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.landlord_properties WHERE id = property_id AND landlord_id = auth.uid())
);
CREATE POLICY "Landlords can update applicants for own properties" ON public.applicants FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.landlord_properties WHERE id = property_id AND landlord_id = auth.uid())
);
