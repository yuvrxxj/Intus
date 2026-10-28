-- Early-access waitlist (INT-94). These rows are not accounts: there is no user_id, and nothing in the API can
-- read them. The join-waitlist Edge Function writes them with the service role, which bypasses row level security.
--
-- The address is stored in lower case. A check refuses anything else, so the unique constraint is case-insensitive
-- without citext (the throwaway database the migration tests run on has no citext extension). The edge function
-- lowercases before it inserts. A@B.com and a@b.com are one address.
--
-- status starts at pending. Only a confirmed row may later be invited. The confirmation email is not sent by
-- this migration. confirm_token_hash is the SHA-256 of the token that email will carry, and
-- confirm_token_expires_at is seven days after it was issued. Opening the link sets confirmed_at and keeps the
-- hash, so the same link can be opened again to see or change the optional answers. confirm_sent_at is when the
-- token was last issued. tracks_today and answered_at are those answers. The raw token is never stored.
--
-- TODO(INT-94 follow-up): Resend confirmation email. Country, campaign/UTM and analytics are later pull requests
-- and have no columns here yet.
--
-- Safe to run twice.

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  device text not null check (device in ('laptop', 'iphone', 'android')),
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  confirm_token_hash text,
  confirm_token_expires_at timestamptz,
  -- When the current token was issued. The Resend pull request is what actually sends the email.
  confirm_sent_at timestamptz,
  confirmed_at timestamptz,
  tracks_today text,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint waitlist_email_unique unique (email),
  constraint waitlist_email_lower check (email = lower(email)),
  constraint waitlist_email_length check (char_length(email) between 3 and 254),
  constraint waitlist_token_hash check (confirm_token_hash is null or confirm_token_hash ~ '^[0-9a-f]{64}$'),
  constraint waitlist_token_pair check (
    (confirm_token_hash is null and confirm_token_expires_at is null)
    or (confirm_token_hash is not null and confirm_token_expires_at is not null)
  ),
  constraint waitlist_confirmed_fields check (
    (status = 'confirmed' and confirmed_at is not null)
    or (status = 'pending' and confirmed_at is null)
  ),
  -- A pending row still has a live token. Confirming keeps it, so the same link can open the page again.
  constraint waitlist_pending_has_token check (status <> 'pending' or confirm_token_hash is not null),
  constraint waitlist_tracks_today_length check (tracks_today is null or char_length(tracks_today) <= 280)
);

create unique index if not exists waitlist_confirm_token_hash_idx
  on public.waitlist (confirm_token_hash)
  where confirm_token_hash is not null;

alter table public.waitlist enable row level security;
alter table public.waitlist force row level security;

-- No policy: with row level security forced, the API roles see nothing. The service role bypasses it.
revoke all on table public.waitlist from public, anon, authenticated;
grant select, insert, update on table public.waitlist to service_role;

comment on table public.waitlist is
  'Early-access waitlist. No public read. The join-waitlist edge function is the only writer. Confirm tokens are stored as SHA-256 hashes. Only status = confirmed is eligible for an invite.';
