-- Fix match_score to store decimals (was INT, truncating 9.1 → 9)
ALTER TABLE public.applicants
  ALTER COLUMN match_score TYPE NUMERIC(4,1) USING match_score::NUMERIC(4,1);

-- Add unique constraint so upsert on re-submission works correctly
ALTER TABLE public.applicants
  ADD CONSTRAINT applicants_property_phone_unique UNIQUE (property_id, phone);
