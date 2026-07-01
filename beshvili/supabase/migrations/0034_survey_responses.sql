CREATE TABLE IF NOT EXISTS survey_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  question_key text NOT NULL,
  answer text NOT NULL,
  trigger_context text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, question_key)
);

ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_insert_own" ON survey_responses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own" ON survey_responses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin_read_all" ON survey_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND plan = 'admin')
  );
