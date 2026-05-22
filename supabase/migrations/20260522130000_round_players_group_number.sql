-- 同场多组：每位参与者归属一个组编号（默认第 1 组）
ALTER TABLE round_players ADD COLUMN IF NOT EXISTS group_number int NOT NULL DEFAULT 1;

COMMENT ON COLUMN round_players.group_number IS '同场分组编号，记分员仅可编辑本组成员';
