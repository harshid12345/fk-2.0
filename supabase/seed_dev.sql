-- ============================================================
-- FairKamer Dev Seed — 4 properties + 17 applicants
-- Paste this entire script into:
--   Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

DO $$
DECLARE
  uid   UUID;
  p1_id UUID;
  p2_id UUID;
  p3_id UUID;
  p4_id UUID;
BEGIN

-- ── 0. Get the landlord user ID ──────────────────────────────────────────────
SELECT id INTO uid FROM auth.users WHERE email = 'tanush@fairkamer.nl' LIMIT 1;
IF uid IS NULL THEN
  RAISE EXCEPTION 'User tanush@fairkamer.nl not found. Sign in once first.';
END IF;

-- ── 1. Add new columns if they don't exist ───────────────────────────────────
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS smoking TEXT;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS pets TEXT;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS monthly_income_range TEXT;

-- ── 2. Clear existing seed data (clean slate) ────────────────────────────────
DELETE FROM public.applicants WHERE property_id IN (
  SELECT id FROM public.landlord_properties WHERE landlord_id = uid
);
DELETE FROM public.landlord_properties WHERE landlord_id = uid;

-- ── 3. Insert 4 properties ───────────────────────────────────────────────────
INSERT INTO public.landlord_properties (landlord_id, address, postcode, city, surface_m2, rent_amount, accommodation_type, property_type, status, bag_verified, application_token)
VALUES
  (uid, 'Keizersgracht 312',      '1016 EX', 'Amsterdam', 72, 1850, 'independent', 'apartment', 'seeking', TRUE,  'seed-token-amst')
RETURNING id INTO p1_id;

INSERT INTO public.landlord_properties (landlord_id, address, postcode, city, surface_m2, rent_amount, accommodation_type, property_type, status, bag_verified, application_token)
VALUES
  (uid, 'Witte de Withstraat 88', '3012 BN', 'Rotterdam', 55, 1200, 'independent', 'apartment', 'seeking', FALSE, 'seed-token-rdam')
RETURNING id INTO p2_id;

INSERT INTO public.landlord_properties (landlord_id, address, postcode, city, surface_m2, rent_amount, accommodation_type, property_type, status, bag_verified, application_token)
VALUES
  (uid, 'Binnenhof 9',            '2513 AA', 'Den Haag',  90, 2100, 'independent', 'house',     'seeking', TRUE,  'seed-token-dhag')
RETURNING id INTO p3_id;

INSERT INTO public.landlord_properties (landlord_id, address, postcode, city, surface_m2, rent_amount, accommodation_type, property_type, status, bag_verified, application_token)
VALUES
  (uid, 'Nachtegaalstraat 24',    '3581 AC', 'Utrecht',   48, 1050, 'shared',      'room',      'seeking', FALSE, 'seed-token-utre')
RETURNING id INTO p4_id;

-- ── 4. Insert 17 applicants ──────────────────────────────────────────────────

-- Property 1: Keizersgracht 312, Amsterdam (€1 850)
INSERT INTO public.applicants (property_id, full_name, phone, email, age, employment_type, monthly_income_range, num_occupants, desired_move_in, smoking, pets, bkr_status, match_score, match_label, hard_disqualified, stage, lifestyle_answers, consent_given)
VALUES
(p1_id, 'Lena de Vries',    '+31612345601', 'lena.devries@gmail.com',    29, 'Loondienst (employed)', '€3 500 – €4 500', '2 people',  'This month',  'No',           'Cat',     'No', 9.1, 'Strong match',   FALSE, 'new',      '{"smoking":"No","pets":"Cat","income_range":"€3 500 – €4 500"}'::jsonb, TRUE),
(p1_id, 'Bram Janssen',     '+31612345602', 'bram.j@outlook.com',        34, 'ZZP (self-employed)',   '€4 500 – €6 000', 'Just me',   'Next month',  'No',           'No pets', 'No', 8.7, 'Strong match',   FALSE, 'accepted', '{"smoking":"No","pets":"No pets","income_range":"€4 500 – €6 000"}'::jsonb, TRUE),
(p1_id, 'Sophie Meijer',    '+31612345603', 'sophiemeijer@hotmail.nl',   26, 'Student',               '€1 000 – €1 500', 'Just me',   '2–3 months',  'No',           'No pets', 'No', 3.4, 'Weak match',     TRUE,  'new',      '{"smoking":"No","pets":"No pets","income_range":"€1 000 – €1 500"}'::jsonb, TRUE),
(p1_id, 'Niels Bakker',     '+31612345604', 'niels.bakker@gmail.com',    31, 'Loondienst (employed)', '€3 000 – €3 500', '2 people',  'Next month',  'Outside only', 'Dog',     'No', 6.8, 'Good match',     FALSE, 'new',      '{"smoking":"Outside only","pets":"Dog","income_range":"€3 000 – €3 500"}'::jsonb, TRUE),
(p1_id, 'Emma van den Berg','+31612345605', 'emma.vdberg@gmail.com',     28, 'Loondienst (employed)', '€2 500 – €3 000', 'Just me',   'Flexible',    'No',           'No pets', 'Yes I can explain', 5.2, 'Moderate match', FALSE, 'rejected', '{"smoking":"No","pets":"No pets","income_range":"€2 500 – €3 000"}'::jsonb, TRUE);

-- Update hard_disqualify_reason for Sophie
UPDATE public.applicants SET hard_disqualify_reason = 'Income below 3× rent threshold' WHERE full_name = 'Sophie Meijer' AND property_id = p1_id;

-- Property 2: Witte de Withstraat 88, Rotterdam (€1 200)
INSERT INTO public.applicants (property_id, full_name, phone, email, age, employment_type, monthly_income_range, num_occupants, desired_move_in, smoking, pets, bkr_status, match_score, match_label, hard_disqualified, stage, lifestyle_answers, consent_given)
VALUES
(p2_id, 'Lars Visser',    '+31612345606', 'lars.visser@kpn.nl',     24, 'Loondienst (employed)', '€2 500 – €3 000', 'Just me',  'This month',  'No',  'No pets', 'No',  8.2, 'Strong match',   FALSE, 'new',      '{"smoking":"No","pets":"No pets","income_range":"€2 500 – €3 000"}'::jsonb, TRUE),
(p2_id, 'Anouk Smit',     '+31612345607', 'anouksmit@live.nl',      22, 'Student',               '€1 500 – €2 000', 'Just me',  'Next month',  'No',  'No pets', 'No',  5.9, 'Moderate match', FALSE, 'new',      '{"smoking":"No","pets":"No pets","income_range":"€1 500 – €2 000"}'::jsonb, TRUE),
(p2_id, 'Tim van Dijk',   '+31612345608', 'tim.dijk@ziggo.nl',      38, 'Uitkering (benefits)',  '€1 000 – €1 500', '2 people', 'This month',  'Yes', 'Dog',     'No',  0.0, 'Disqualified',   TRUE,  'new',      '{"smoking":"Yes","pets":"Dog","income_range":"€1 000 – €1 500"}'::jsonb, TRUE),
(p2_id, 'Mila Oosterhout','+31612345609', 'mila.o@gmail.com',       27, 'ZZP (self-employed)',   '€3 000 – €3 500', 'Just me',  '2–3 months',  'No',  'Cat',     'No',  7.4, 'Good match',     FALSE, 'accepted', '{"smoking":"No","pets":"Cat","income_range":"€3 000 – €3 500"}'::jsonb, TRUE);

-- Update hard_disqualify_reason for Tim
UPDATE public.applicants SET hard_disqualify_reason = 'Active BKR registration' WHERE full_name = 'Tim van Dijk' AND property_id = p2_id;

-- Property 3: Binnenhof 9, Den Haag (€2 100)
INSERT INTO public.applicants (property_id, full_name, phone, email, age, employment_type, monthly_income_range, num_occupants, desired_move_in, smoking, pets, bkr_status, match_score, match_label, hard_disqualified, stage, lifestyle_answers, consent_given)
VALUES
(p3_id, 'Daan Koopman',      '+31612345610', 'daan.k@proton.me',       41, 'Loondienst (employed)', '€6 000+',         '4+ people', 'Next month', 'No',           'No pets', 'No', 9.4, 'Strong match', FALSE, 'new',      '{"smoking":"No","pets":"No pets","income_range":"€6 000+"}'::jsonb, TRUE),
(p3_id, 'Fleur Hendriksen',  '+31612345611', 'fleur.h@gmail.com',      33, 'Loondienst (employed)', '€4 500 – €6 000', '2 people',  'This month', 'No',           'No pets', 'No', 8.9, 'Strong match', FALSE, 'new',      '{"smoking":"No","pets":"No pets","income_range":"€4 500 – €6 000"}'::jsonb, TRUE),
(p3_id, 'Joost Mulder',      '+31612345612', 'joost.mulder@xs4all.nl', 45, 'ZZP (self-employed)',   '€3 500 – €4 500', '2 people',  '2–3 months', 'Outside only', 'No pets', 'No', 7.1, 'Good match',   FALSE, 'new',      '{"smoking":"Outside only","pets":"No pets","income_range":"€3 500 – €4 500"}'::jsonb, TRUE),
(p3_id, 'Roos van Leeuwen', '+31612345613', 'roos.vl@gmail.com',      30, 'Loondienst (employed)', '€3 000 – €3 500', 'Just me',   'Flexible',   'No',           'Cat',     'No', 6.3, 'Good match',   FALSE, 'rejected', '{"smoking":"No","pets":"Cat","income_range":"€3 000 – €3 500"}'::jsonb, TRUE);

-- Property 4: Nachtegaalstraat 24, Utrecht (€1 050)
INSERT INTO public.applicants (property_id, full_name, phone, email, age, employment_type, monthly_income_range, num_occupants, desired_move_in, smoking, pets, bkr_status, match_score, match_label, hard_disqualified, stage, lifestyle_answers, consent_given)
VALUES
(p4_id, 'Kevin Arends',    '+31612345614', 'kevin.arends@student.uu.nl', 21, 'Student',               '€1 000 – €1 500', 'Just me', 'This month', 'No',  'No pets', 'No', 6.5, 'Good match',     FALSE, 'new',      '{"smoking":"No","pets":"No pets","income_range":"€1 000 – €1 500"}'::jsonb, TRUE),
(p4_id, 'Yasmine El Fassi','+31612345615', 'yasmine.ef@hotmail.com',     25, 'Loondienst (employed)', '€2 000 – €2 500', 'Just me', 'Next month', 'No',  'No pets', 'No', 7.8, 'Good match',     FALSE, 'new',      '{"smoking":"No","pets":"No pets","income_range":"€2 000 – €2 500"}'::jsonb, TRUE),
(p4_id, 'Pieter Hoekstra', '+31612345616', 'p.hoekstra@gmail.com',       23, 'Student',               '€1 500 – €2 000', 'Just me', '2–3 months', 'Yes', 'No pets', 'No', 4.8, 'Moderate match', FALSE, 'new',      '{"smoking":"Yes","pets":"No pets","income_range":"€1 500 – €2 000"}'::jsonb, TRUE),
(p4_id, 'Nina Brouwer',    '+31612345617', 'nina.brouwer@gmail.com',     26, 'Loondienst (employed)', '€2 000 – €2 500', 'Just me', 'This month', 'No',  'No pets', 'No', 8.1, 'Strong match',   FALSE, 'accepted', '{"smoking":"No","pets":"No pets","income_range":"€2 000 – €2 500"}'::jsonb, TRUE);

RAISE NOTICE 'Seed complete! 4 properties and 17 applicants inserted for uid=%', uid;

END $$;
