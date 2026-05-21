-- Add social_platform column so applicants can specify which platform they shared
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS social_platform TEXT;
