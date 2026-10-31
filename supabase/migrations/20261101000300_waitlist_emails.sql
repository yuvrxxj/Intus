-- The second and third waitlist emails (INT-163): "your place is ready" and "the app has launched".
--
-- waitlist.unsubscribed_at is set the first time someone opens the unsubscribe link (a signed link, so no token is
-- stored). Nobody with it set is ever emailed again.
--
-- waitlist_emails_sent holds one row per person per email. The send-waitlist-email function inserts the row BEFORE it
-- sends, and a second insert for the same person and email fails on the primary key, so a retry or a double click can
-- never send the same email twice. If the send fails, the function deletes its row so the person can be retried.
-- Deleting a waitlist row deletes its rows here.
--
-- waitlist_email_recipients(kind, limit, only) lists who is still due an email: confirmed, not unsubscribed, not yet
-- sent this kind, in waitlist_standing place order (place 1 first). `only`, when given, keeps just those addresses
-- (the test allowlist before go-live). The device picks the wording: only iPhone can get in first. waitlist_email_candidate_count(kind, only) counts the same people.
--
-- Row level security is forced and there is no policy; the API roles have no grants. Only the service role can read
-- or write the table or call the functions.
--
-- Safe to run twice.

alter table public.waitlist add column if not exists unsubscribed_at timestamptz;

create table if not exists public.waitlist_emails_sent (
  waitlist_id uuid not null references public.waitlist (id) on delete cascade,
  kind text not null check (kind in ('place_ready', 'launch')),
  sent_at timestamptz not null default now(),
  primary key (waitlist_id, kind)
);

alter table public.waitlist_emails_sent enable row level security;
alter table public.waitlist_emails_sent force row level security;

revoke all on table public.waitlist_emails_sent from public, anon, authenticated;
grant select, insert, delete on table public.waitlist_emails_sent to service_role;

create or replace function public.waitlist_email_recipients(
  p_kind text,
  p_limit integer,
  p_only text[] default null
) returns table (id uuid, email text, device text, place integer)
language plpgsql stable
set search_path = public, pg_temp
as $$
begin
  if p_kind is null or p_kind not in ('place_ready', 'launch') or p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'waitlist_email_recipients: bad arguments' using errcode = 'invalid_parameter_value';
  end if;
  return query
    select w.id, w.email, w.device, s.place
    from public.waitlist_standing s
    join public.waitlist w on w.id = s.id
    where w.status = 'confirmed'
      and w.unsubscribed_at is null
      and (p_only is null or w.email = any (p_only))
      and not exists (select 1 from public.waitlist_emails_sent e where e.waitlist_id = w.id and e.kind = p_kind)
    order by s.place
    limit p_limit;
end;
$$;

create or replace function public.waitlist_email_candidate_count(
  p_kind text,
  p_only text[] default null
) returns integer
language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  if p_kind is null or p_kind not in ('place_ready', 'launch') then
    raise exception 'waitlist_email_candidate_count: bad arguments' using errcode = 'invalid_parameter_value';
  end if;
  select count(*)::int into n
  from public.waitlist w
  where w.status = 'confirmed'
    and w.unsubscribed_at is null
    and (p_only is null or w.email = any (p_only))
    and not exists (select 1 from public.waitlist_emails_sent e where e.waitlist_id = w.id and e.kind = p_kind);
  return n;
end;
$$;

revoke all on function public.waitlist_email_recipients(text, integer, text[]) from public, anon, authenticated;
revoke all on function public.waitlist_email_candidate_count(text, text[]) from public, anon, authenticated;
grant execute on function public.waitlist_email_recipients(text, integer, text[]) to service_role;
grant execute on function public.waitlist_email_candidate_count(text, text[]) to service_role;

comment on column public.waitlist.unsubscribed_at is
  'Set the first time the person opens the unsubscribe link. Nobody with it set is emailed again.';
comment on table public.waitlist_emails_sent is
  'One row per person per waitlist email (place_ready, launch). Inserted before the send so nothing goes twice; deleted if the send fails. Service role only.';
comment on function public.waitlist_email_recipients(text, integer, text[]) is
  'Confirmed, not unsubscribed, not yet sent this kind, in waitlist place order. Service role only.';
comment on function public.waitlist_email_candidate_count(text, text[]) is
  'How many people waitlist_email_recipients would list without a limit. Service role only.';
