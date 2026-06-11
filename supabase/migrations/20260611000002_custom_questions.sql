-- Custom landlord questions per property
CREATE TABLE IF NOT EXISTS property_custom_questions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID NOT NULL REFERENCES landlord_properties(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  is_required  BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcq_property_id ON property_custom_questions(property_id);

-- RLS: landlord can manage their property's questions
ALTER TABLE property_custom_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlord manages own property questions"
  ON property_custom_questions FOR ALL
  USING (
    property_id IN (
      SELECT id FROM landlord_properties WHERE landlord_id = auth.uid()
    )
  );

-- Allow anyone with the apply link (anon) to read questions for a property
CREATE POLICY "Anyone can read questions"
  ON property_custom_questions FOR SELECT
  TO anon, authenticated
  USING (true);

-- Applicants table: add custom_answers column
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS custom_answers JSONB DEFAULT '{}'::jsonb;
