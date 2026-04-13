-- landlord_criteria: replace boolean smoking_allowed with text
ALTER TABLE landlord_criteria DROP COLUMN IF EXISTS smoking_allowed;
ALTER TABLE landlord_criteria ADD COLUMN smoking_allowed TEXT DEFAULT 'No';

-- landlord_criteria: replace boolean pets_allowed with text
ALTER TABLE landlord_criteria DROP COLUMN IF EXISTS pets_allowed;
ALTER TABLE landlord_criteria ADD COLUMN pets_allowed TEXT DEFAULT 'No';

-- landlord_criteria: add new columns
ALTER TABLE landlord_criteria ADD COLUMN IF NOT EXISTS max_occupants INT DEFAULT 1;
ALTER TABLE landlord_criteria ADD COLUMN IF NOT EXISTS accepted_tenant_types JSONB;
ALTER TABLE landlord_criteria ADD COLUMN IF NOT EXISTS references_required BOOLEAN DEFAULT FALSE;
ALTER TABLE landlord_criteria ADD COLUMN IF NOT EXISTS min_income NUMERIC;

-- applicants: add new screening fields
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS num_occupants TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS desired_move_in TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS employment_type TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS desired_lease_length TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bkr_status TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS consent_given BOOLEAN DEFAULT FALSE;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS scrape_linkedin JSONB;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS scrape_facebook JSONB;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS scrape_google JSONB;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS scrape_kvk JSONB;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS match_label TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS hard_disqualified BOOLEAN DEFAULT FALSE;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS hard_disqualify_reason TEXT;

-- landlord_properties: add new fields
ALTER TABLE landlord_properties ADD COLUMN IF NOT EXISTS furnished_status TEXT;
ALTER TABLE landlord_properties ADD COLUMN IF NOT EXISTS num_rooms INT;
ALTER TABLE landlord_properties ADD COLUMN IF NOT EXISTS available_date DATE;
ALTER TABLE landlord_properties ADD COLUMN IF NOT EXISTS min_lease_length TEXT;
ALTER TABLE landlord_properties ADD COLUMN IF NOT EXISTS sector TEXT;