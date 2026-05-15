-- ============================================================
-- FairKamer Dev Seed
-- Run once in the Supabase SQL Editor after running migrations.
-- Creates a confirmed dev user + 3 Den Haag properties + 9 applicants.
-- ============================================================

DO $$
DECLARE
  dev_id   UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  prop1_id UUID := 'b1000000-0000-0000-0000-000000000001';
  prop2_id UUID := 'b1000000-0000-0000-0000-000000000002';
  prop3_id UUID := 'b1000000-0000-0000-0000-000000000003';
BEGIN

-- ============================================================
-- 1. DEV AUTH USER (pre-confirmed, no email needed)
-- ============================================================

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
)
VALUES (
  dev_id,
  '00000000-0000-0000-0000-000000000000',
  'dev@fairkamer.test',
  crypt('devpass123', gen_salt('bf')),
  now(),
  '{"full_name": "Jan de Vries"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

-- Email identity so sign-in works
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  dev_id,
  'dev@fairkamer.test',
  jsonb_build_object('sub', dev_id::text, 'email', 'dev@fairkamer.test'),
  'email',
  now(),
  now(),
  now()
)
ON CONFLICT (provider, provider_id) DO NOTHING;

-- ============================================================
-- 2. LANDLORD PROFILE
-- ============================================================

INSERT INTO public.landlords (id, full_name, email, phone, portfolio_size, created_at)
VALUES (dev_id, 'Jan de Vries', 'dev@fairkamer.test', '+31 6 1234 5678', '2-5', now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. PROPERTIES (3x Den Haag)
-- ============================================================

INSERT INTO public.landlord_properties (
  id, landlord_id, address, postcode, city,
  surface_m2, building_year, energy_label,
  rent_amount, accommodation_type,
  wws_points, wws_max_rent, wws_compliant,
  status, furnished_status, num_rooms,
  available_date, min_lease_length, sector,
  bag_verified, knowledge_base_urls
)
VALUES
(
  prop1_id, dev_id,
  'Laan van Meerdervoort 250', '2563 AH', 'Den Haag',
  58, 1922, 'C',
  1150, 'independent',
  148, 1050, false,
  'seeking', 'Unfurnished', 3,
  '2026-05-01', '12 months', 'Vrije sector',
  true, '{}'
),
(
  prop2_id, dev_id,
  'Fahrenheitstraat 143', '2561 EN', 'Den Haag',
  72, 1968, 'B',
  1350, 'independent',
  172, 1300, false,
  'rented', 'Gestoffeerd (semi)', 4,
  null, '12 months', 'Vrije sector',
  true, '{}'
),
(
  prop3_id, dev_id,
  'Nieuwe Schoolstraat 30', '2514 HZ', 'Den Haag',
  45, 1905, 'D',
  950, 'independent',
  118, 900, false,
  'seeking', 'Unfurnished', 2,
  '2026-04-15', '6 months', 'Middenhuur',
  false, '{}'
)
ON CONFLICT (id) DO NOTHING;

-- Tenant details for the rented property
UPDATE public.landlord_properties
SET
  tenant_name = 'Lisa van den Berg',
  tenant_contract_start = '2025-09-01',
  tenant_monthly_rent = 1350,
  tenant_deposit = 2700,
  tenant_phone = '+31 6 8765 4321',
  tenant_email = 'lisa.vandenberg@gmail.com'
WHERE id = prop2_id;

-- ============================================================
-- 4. TENANT CRITERIA
-- ============================================================

INSERT INTO public.landlord_criteria (
  property_id, max_occupants, smoking_allowed, pets_allowed,
  accepted_tenant_types, min_income, references_required
)
VALUES
(
  prop1_id, 2, 'No', 'No',
  '["Working professional", "ZZP"]'::jsonb,
  3450, true
),
(
  prop2_id, 3, 'Outside only', 'Negotiable',
  '["Working professional", "Family", "ZZP"]'::jsonb,
  4050, false
),
(
  prop3_id, 1, 'No', 'No',
  '["Working professional", "Student"]'::jsonb,
  2850, false
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. APPLICANTS (3 per property = 9 total)
-- ============================================================

-- Property 1 (Laan van Meerdervoort — seeking)
INSERT INTO public.applicants (
  property_id, full_name, employment_type, monthly_income,
  num_occupants, desired_move_in, desired_lease_length,
  bkr_status, match_score, match_label, hard_disqualified,
  lifestyle_answers, stage, preferred_language,
  telegram_user_id, telegram_chat_id, consent_given
)
VALUES
(
  prop1_id, 'Daan Hartman', 'Employed', 4200,
  'Just me', 'Next month', '12 months',
  'Clean', 8, 'Strong match', false,
  '{"smoking": "No", "pets": "None", "income_range": "3500-5000"}'::jsonb,
  'completed', 'nl',
  'tg_101', 100001, true
),
(
  prop1_id, 'Emma Visser', 'ZZP', 3800,
  'Just me', 'ASAP', 'As long as possible',
  'Clean', 6, 'Good match', false,
  '{"smoking": "No", "pets": "Cat", "income_range": "3500-5000"}'::jsonb,
  'completed', 'nl',
  'tg_102', 100002, true
),
(
  prop1_id, 'Pieter van Dijk', 'Employed', 2800,
  '2', 'Next month', '12 months',
  'Clean', 4, 'Moderate match', false,
  '{"smoking": "No", "pets": "None", "income_range": "2500-3500"}'::jsonb,
  'completed', 'nl',
  'tg_103', 100003, true
);

-- Property 2 (Fahrenheitstraat — rented, concierge only)
INSERT INTO public.applicants (
  property_id, full_name, employment_type, monthly_income,
  num_occupants, desired_move_in, desired_lease_length,
  bkr_status, match_score, match_label, hard_disqualified,
  lifestyle_answers, stage, preferred_language,
  telegram_user_id, telegram_chat_id, consent_given
)
VALUES
(
  prop2_id, 'Noor Bakker', 'Employed', 5200,
  '2', 'ASAP', '24 months',
  'Clean', 9, 'Strong match', false,
  '{"smoking": "No", "pets": "None", "income_range": "5000+"}'::jsonb,
  'completed', 'nl',
  'tg_201', 200001, true
),
(
  prop2_id, 'Thomas de Jong', 'Employed', 4800,
  'Just me', 'Next month', 'As long as possible',
  'Clean', 7, 'Good match', false,
  '{"smoking": "Outside only", "pets": "Dog", "income_range": "3500-5000"}'::jsonb,
  'completed', 'en',
  'tg_202', 200002, true
),
(
  prop2_id, 'Sarah Willems', 'Benefits', 1200,
  'Just me', 'ASAP', '12 months',
  'Has issues to explain', 0, 'Disqualified', true,
  '{"smoking": "Yes", "pets": "None", "income_range": "<1500"}'::jsonb,
  'completed', 'nl',
  'tg_203', 200003, true
);

-- Property 3 (Nieuwe Schoolstraat — seeking)
INSERT INTO public.applicants (
  property_id, full_name, employment_type, monthly_income,
  num_occupants, desired_move_in, desired_lease_length,
  bkr_status, match_score, match_label, hard_disqualified,
  lifestyle_answers, stage, preferred_language,
  telegram_user_id, telegram_chat_id, consent_given
)
VALUES
(
  prop3_id, 'Sanne Smit', 'Student', 1100,
  'Just me', 'Next month', '12 months',
  'Clean', 5, 'Moderate match', false,
  '{"smoking": "No", "pets": "None", "income_range": "<1500"}'::jsonb,
  'completed', 'nl',
  'tg_301', 300001, true
),
(
  prop3_id, 'Mohamed El Amine', 'Employed', 3100,
  'Just me', 'ASAP', '12 months',
  'Clean', 8, 'Strong match', false,
  '{"smoking": "No", "pets": "None", "income_range": "2500-3500"}'::jsonb,
  'completed', 'en',
  'tg_302', 300002, true
),
(
  prop3_id, 'Julia Koopman', 'Employed', 2900,
  'Just me', 'Flexible', '6 months',
  'Clean', 6, 'Good match', false,
  '{"smoking": "No", "pets": "Cat", "income_range": "2500-3500"}'::jsonb,
  'completed', 'nl',
  'tg_303', 300003, true
);

END $$;
