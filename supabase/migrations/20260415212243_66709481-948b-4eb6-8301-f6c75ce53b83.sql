
-- Add reminder tracking columns to viewing_bookings
ALTER TABLE public.viewing_bookings 
  ADD COLUMN reminder_24h_sent_at timestamptz,
  ADD COLUMN reminder_24h_response text,
  ADD COLUMN reminder_2h_sent_at timestamptz,
  ADD COLUMN reminder_2h_response text,
  ADD COLUMN cascade_state text,
  ADD COLUMN cascade_data jsonb;

-- Add cancellation tracking to applicants
ALTER TABLE public.applicants
  ADD COLUMN cancellation_count integer DEFAULT 0,
  ADD COLUMN no_response_count integer DEFAULT 0;
