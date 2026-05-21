-- Add explicit lifestyle columns to applicants so the app can query them directly.
-- These mirror what submit-application already saves in lifestyle_answers JSONB.
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS smoking TEXT;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS pets TEXT;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS monthly_income_range TEXT;

-- Back-fill from existing lifestyle_answers for any rows that have the data
UPDATE public.applicants
SET
  smoking             = lifestyle_answers->>'smoking',
  pets                = lifestyle_answers->>'pets',
  monthly_income_range = lifestyle_answers->>'income_range'
WHERE lifestyle_answers IS NOT NULL
  AND (smoking IS NULL OR pets IS NULL OR monthly_income_range IS NULL);
