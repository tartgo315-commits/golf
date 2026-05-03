-- Run on Supabase SQL editor or via CLI if green_speed is not yet on rounds.
alter table public.rounds
  add column if not exists green_speed smallint;

comment on column public.rounds.green_speed is 'Green speed (Stimp), typically 6–15';
