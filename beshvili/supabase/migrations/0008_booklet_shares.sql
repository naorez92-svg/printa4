-- Add share_token to booklets for public unguessable share links
alter table public.booklets
  add column if not exists share_token uuid unique default gen_random_uuid();

create index if not exists booklets_share_token_idx on public.booklets (share_token);
