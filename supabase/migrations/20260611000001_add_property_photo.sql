-- Add property photo URL to landlord_properties
ALTER TABLE landlord_properties ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add application_token if not present (may already exist in some envs)
ALTER TABLE landlord_properties ADD COLUMN IF NOT EXISTS application_token TEXT;

-- Add missing applicant columns from migration 20260521000002
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS smoking TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS pets TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS monthly_income_range TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS social_platform TEXT;
