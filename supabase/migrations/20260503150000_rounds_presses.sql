-- Nassau Press 等扩展：存 rounds 级 jsonb（默认空数组）
ALTER TABLE rounds
  ADD COLUMN IF NOT EXISTS presses jsonb DEFAULT '[]'::jsonb;
