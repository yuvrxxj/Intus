-- Row-level security checks for 20261005000100_multi_user.sql.
--
-- Run it against a database that has every migration applied (a Supabase branch or a local copy), as the postgres role:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/multi_user_rls.sql
-- It creates two throwaway users inside a transaction and rolls everything back, so it leaves nothing behind.
-- Any failed check raises an error and stops the run; a pass prints "ok" notices and ends with ROLLBACK.

begin;

create schema tt;
grant usage on schema tt to anon, authenticated;

create function tt.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end
$$;

create function tt.expect_count(label text, q text, want bigint) returns void language plpgsql as $$
declare got bigint;
begin
  execute 'select count(*) from (' || q || ') s' into got;
  if got <> want then raise exception 'FAIL %: expected % rows, got %', label, want, got; end if;
  raise notice 'ok   %', label;
end
$$;

create function tt.expect_affected(label text, stmt text, want bigint) returns void language plpgsql as $$
declare got bigint;
begin
  execute stmt;
  get diagnostics got = row_count;
  if got <> want then raise exception 'FAIL %: expected % rows affected, got %', label, want, got; end if;
  raise notice 'ok   %', label;
end
$$;

-- 42501 is also what a row-level security violation raises, so this covers "not allowed" in both forms.
create function tt.expect_denied(label text, stmt text) returns void language plpgsql as $$
declare allowed boolean := false;
begin
  begin
    execute stmt;
    allowed := true;
  exception when insufficient_privilege then
    null;
  end;
  if allowed then raise exception 'FAIL %: the statement was allowed', label; end if;
  raise notice 'ok   %', label;
end
$$;

create function tt.expect_unique_violation(label text, stmt text) returns void language plpgsql as $$
declare allowed boolean := false;
begin
  begin
    execute stmt;
    allowed := true;
  exception when unique_violation then
    null;
  end;
  if allowed then raise exception 'FAIL %: a duplicate was accepted', label; end if;
  raise notice 'ok   %', label;
end
$$;

grant execute on all functions in schema tt to anon, authenticated;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@example.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@example.test');

-- ---- user A writes their own rows
set local role authenticated;
select tt.as_user('aaaaaaaa-0000-0000-0000-00000000000a');

insert into public.daily_logs (log_date, weight) values ('2030-01-01', 80);
insert into public.medications (name) values ('A creatine');
insert into public.profile (age, sex) values (30, 'male');
select tt.expect_count('A sees their own log', $q$ select 1 from public.daily_logs $q$, 1);
select tt.expect_count('user_id defaults to the signed-in user',
  $q$ select 1 from public.daily_logs where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a' $q$, 1);

-- saving the same day twice updates it (this is what saveLog does)
insert into public.daily_logs (log_date, weight) values ('2030-01-01', 79)
  on conflict (user_id, log_date) do update set weight = excluded.weight;
select tt.expect_count('upsert on (user_id, log_date) keeps one row per day',
  $q$ select 1 from public.daily_logs where weight = 79 $q$, 1);
select tt.expect_count('and does not add a second', $q$ select 1 from public.daily_logs $q$, 1);

select tt.expect_unique_violation('A cannot have two profiles', $q$ insert into public.profile (age, sex) values (31, 'male') $q$);

-- ---- user B cannot see or touch A's rows
select tt.as_user('bbbbbbbb-0000-0000-0000-00000000000b');

select tt.expect_count('B sees none of A''s logs', $q$ select 1 from public.daily_logs $q$, 0);
select tt.expect_count('B sees none of A''s medications', $q$ select 1 from public.medications $q$, 0);
select tt.expect_count('B sees none of A''s profile', $q$ select 1 from public.profile $q$, 0);
select tt.expect_affected('B cannot update A''s log', $q$ update public.daily_logs set weight = 1 $q$, 0);
select tt.expect_affected('B cannot delete A''s log', $q$ delete from public.daily_logs $q$, 0);
select tt.expect_denied('B cannot write a row as A',
  $q$ insert into public.daily_logs (log_date, user_id) values ('2030-01-02', 'aaaaaaaa-0000-0000-0000-00000000000a') $q$);
insert into public.medications (name) values ('B zinc');
select tt.expect_denied('B cannot hand their own row to A',
  $q$ update public.medications set user_id = 'aaaaaaaa-0000-0000-0000-00000000000a' $q$);

-- B can log the same day as A: the daily uniqueness is per person now
insert into public.daily_logs (log_date, weight) values ('2030-01-01', 90);
select tt.expect_count('B can log the same date as A', $q$ select 1 from public.daily_logs $q$, 1);
insert into public.profile (age, sex) values (25, 'female');
select tt.expect_count('B gets their own profile', $q$ select 1 from public.profile $q$, 1);

-- ---- reference tables: readable, never writable through the API
select tt.expect_denied('B cannot add a biomarker',
  $q$ insert into public.biomarkers (code, name, unit, category) values ('x', 'x', 'x', 'x') $q$);
select tt.expect_denied('B cannot edit screening rules', $q$ update public.screening_rules set label = 'x' $q$);
select tt.expect_denied('B cannot delete biomarkers', $q$ delete from public.biomarkers $q$);

-- ---- tables no feature uses yet are closed
select tt.expect_denied('unused table: meals', $q$ select * from public.meals $q$);
select tt.expect_denied('unused table: diagnoses', $q$ select * from public.diagnoses $q$);
select tt.expect_denied('unused table: photo_log', $q$ select * from public.photo_log $q$);

-- ---- nobody can reach app_owner
select tt.expect_denied('app_owner is closed', $q$ select * from public.app_owner $q$);

-- ---- signed out sees nothing at all
reset role;
set local role anon;
select tt.expect_denied('anon cannot read logs', $q$ select * from public.daily_logs $q$);
select tt.expect_denied('anon cannot read reference data', $q$ select * from public.biomarkers $q$);

rollback;
