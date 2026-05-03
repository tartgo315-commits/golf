-- 挂花事件账本：逐洞事件列表 + 开局配置（JSONB）

alter table public.bets
  add column if not exists events jsonb default '[]'::jsonb;

alter table public.bets
  add column if not exists event_config jsonb default null;

comment on column public.bets.events is 'Hole hang-hua events: [{ hole, playerIndex, event }]';
comment on column public.bets.event_config is 'EventModifierConfig JSON';
