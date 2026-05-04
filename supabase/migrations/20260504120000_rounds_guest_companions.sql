-- 开局同行访客（无 Supabase 账号），与 round_players 中注册用户并存
ALTER TABLE rounds
  ADD COLUMN IF NOT EXISTS guest_companions jsonb DEFAULT '[]'::jsonb;
