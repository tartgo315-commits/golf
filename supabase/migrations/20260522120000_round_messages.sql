-- 球局内讨论（记分页聊天）
CREATE TABLE IF NOT EXISTS round_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS round_messages_round_id_created_at_idx
  ON round_messages (round_id, created_at);

ALTER TABLE round_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "round_messages read all" ON round_messages;
CREATE POLICY "round_messages read all" ON round_messages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "round_messages insert own" ON round_messages;
CREATE POLICY "round_messages insert own" ON round_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
