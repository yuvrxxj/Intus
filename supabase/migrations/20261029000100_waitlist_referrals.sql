-- Waitlist referrals (INT-151). A confirmed sign-up gets a short link (intus.fit/?ref=CODE). When a friend joins
-- through it and confirms by email, the referrer moves up. Everyone still gets in at launch: the place only decides
-- who gets in first.
--
-- referral_code is generated here, in the database, and is unique. Every row gets one (existing rows are filled by
-- adding the column), but the page only shows it after the person has confirmed.
-- referred_by points at the row whose link the person used. It is set once, when the row is created, and it is
-- cleared if the referrer's row is ever deleted.
--
-- A person cannot refer themselves: a trigger refuses a row whose referrer is itself, or whose address is the same
-- as the referrer's once the +tag is dropped (and, for gmail.com and googlemail.com, the dots). The edge function
-- checks the same thing first; the trigger is the backstop.
--
-- The place is never stored. waitlist_standing computes it for confirmed rows only: most confirmed friends first,
-- then whoever signed up earliest. A referral counts only when the friend's own row is confirmed. Row level security
-- stays as it was: the API roles see nothing, and only the join-waitlist function (service role) reads the view.
--
-- Safe to run twice.

create or replace function public.waitlist_new_referral_code() returns text
language sql volatile
as $$ select upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 10)) $$;

alter table public.waitlist
  add column if not exists referral_code text not null default public.waitlist_new_referral_code(),
  add column if not exists referred_by uuid references public.waitlist (id) on delete set null;

create unique index if not exists waitlist_referral_code_idx on public.waitlist (referral_code);
create index if not exists waitlist_referred_by_idx on public.waitlist (referred_by) where referred_by is not null;

alter table public.waitlist drop constraint if exists waitlist_referral_code_format;
alter table public.waitlist add constraint waitlist_referral_code_format check (referral_code ~ '^[0-9A-F]{10}$');

-- The address with the +tag removed, and the dots removed for gmail. Used only to catch someone referring themselves.
create or replace function public.waitlist_normal_email(addr text) returns text
language sql immutable
as $$
  select case
    when s.domain in ('gmail.com', 'googlemail.com') then replace(split_part(s.local_part, '+', 1), '.', '') || '@gmail.com'
    else split_part(s.local_part, '+', 1) || '@' || s.domain
  end
  from (select lower(split_part(addr, '@', 1)) as local_part, lower(split_part(addr, '@', 2)) as domain) s
$$;

create or replace function public.waitlist_block_self_referral() returns trigger
language plpgsql
as $$
declare
  referrer_email text;
begin
  if new.referred_by is null then
    return new;
  end if;
  if new.referred_by = new.id then
    raise exception 'waitlist: a row cannot refer itself' using errcode = 'check_violation';
  end if;
  select email into referrer_email from public.waitlist where id = new.referred_by;
  if referrer_email is not null and public.waitlist_normal_email(referrer_email) = public.waitlist_normal_email(new.email) then
    raise exception 'waitlist: a person cannot refer themselves' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists waitlist_block_self_referral on public.waitlist;
create trigger waitlist_block_self_referral
  before insert or update of referred_by, email on public.waitlist
  for each row execute function public.waitlist_block_self_referral();

-- Computed, not stored. Confirmed rows only. security_invoker makes the view obey the caller's row level security,
-- so the API roles (no policy, no grant) read nothing and the service role (bypasses it) reads everything.
create or replace view public.waitlist_standing with (security_invoker = true) as
with counts as (
  select referred_by as id, count(*)::int as referrals
  from public.waitlist
  where status = 'confirmed' and referred_by is not null
  group by referred_by
)
select
  w.id,
  w.referral_code,
  coalesce(c.referrals, 0) as referrals,
  (row_number() over (order by coalesce(c.referrals, 0) desc, w.created_at asc, w.id))::int as place
from public.waitlist w
left join counts c on c.id = w.id
where w.status = 'confirmed';

revoke all on function public.waitlist_new_referral_code() from public, anon, authenticated;
revoke all on function public.waitlist_normal_email(text) from public, anon, authenticated;
revoke all on function public.waitlist_block_self_referral() from public, anon, authenticated;
revoke all on table public.waitlist_standing from public, anon, authenticated;
grant select on table public.waitlist_standing to service_role;
grant select, insert, update on table public.waitlist to service_role;

comment on view public.waitlist_standing is
  'Place on the waitlist among confirmed rows: most confirmed referrals first, then earliest sign-up. Computed, never stored. Service role only.';
