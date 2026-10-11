-- Photo check-ins: progress photos a person takes of themselves, kept private.
--
-- The pictures live in a private Storage bucket, one folder per person (<user id>/<photo id>.jpg or .webp).
-- The row that describes each one (date, pose, weight that day) is the existing photo_log table, which already has
-- the own-rows policy. photo_log.photo_url stays unused; the new storage_path holds the object's name, never a URL,
-- because a private object is only reachable through a short-lived signed link made on demand.
--
-- What keeps the pictures private and bounded:
--   - the bucket is private, so there is no public link to a file, only signed ones the owner can ask for
--   - every policy on storage.objects limits the person to their own folder, and nothing is open to the signed-out role
--   - an upload has to be named exactly <own user id>/<uuid>.jpg or .webp, so there are no stray folders or names
--   - the bucket refuses files over 2 MiB and anything that is not a JPEG or WebP
--   - a person can hold at most 200 pictures (a few years of weekly photos from three angles)
--   - there is no update policy: a picture is added or deleted, never overwritten
--
-- Deleting an account: removing a row from storage.objects with SQL leaves the file itself in the bucket, so the
-- database cannot delete the pictures. The app removes them through the Storage API first. To make sure they can never
-- be orphaned by calling the function directly, delete_my_account() now refuses while the caller still has pictures.
--
-- This only adds columns, a bucket, policies and a function, and replaces one function; nothing is dropped or rewritten.

-- ── the rows ─────────────────────────────────────────────────────────────────────────────────────────────

alter table public.photo_log
  add column if not exists storage_path text,
  add column if not exists pose text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.photo_log'::regclass and conname = 'photo_log_storage_path_own_folder') then
    alter table public.photo_log add constraint photo_log_storage_path_own_folder
      check (storage_path is null or storage_path ~ ('^' || user_id::text || '/[0-9a-f-]{36}\.(jpg|webp)$'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.photo_log'::regclass and conname = 'photo_log_pose_known') then
    alter table public.photo_log add constraint photo_log_pose_known
      check (pose is null or pose in ('front', 'side', 'back', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.photo_log'::regclass and conname = 'photo_log_label_short') then
    alter table public.photo_log add constraint photo_log_label_short
      check (label is null or char_length(label) <= 40);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.photo_log'::regclass and conname = 'photo_log_weight_plausible') then
    alter table public.photo_log add constraint photo_log_weight_plausible
      check (weight is null or (weight >= 20 and weight <= 500));
  end if;
end
$$;

create unique index if not exists photo_log_storage_path_key on public.photo_log (storage_path);
create index if not exists photo_log_user_date_idx on public.photo_log (user_id, log_date desc);

-- ── the files ────────────────────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('check-in-photos', 'check-in-photos', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- How many pictures the caller already holds. A policy on storage.objects cannot count storage.objects itself (Postgres
-- reports infinite recursion), so the count is a function with its owner's rights. It takes no arguments and only ever
-- counts the caller's own folder.
--
-- Both functions here read storage.objects as their owner. On Supabase that owner is postgres, which bypasses row level
-- security. "set row_security = off" makes that a hard requirement: if the owner ever stopped bypassing it, Postgres
-- would raise an error (uploads and account deletion stop) instead of the functions quietly seeing no pictures.
create schema if not exists private;

create or replace function private.my_check_in_photo_count()
returns integer
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select count(*)::integer
    from storage.objects o
   where o.bucket_id = 'check-in-photos'
     and (storage.foldername(o.name))[1] = (select auth.uid())::text
$$;

revoke all on function private.my_check_in_photo_count() from public, anon;
grant execute on function private.my_check_in_photo_count() to authenticated;
grant usage on schema private to authenticated;

drop policy if exists check_in_photos_select on storage.objects;
drop policy if exists check_in_photos_insert on storage.objects;
drop policy if exists check_in_photos_delete on storage.objects;

create policy check_in_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'check-in-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy check_in_photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'check-in-photos'
    and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.(jpg|webp)$')
    and (select private.my_check_in_photo_count()) < 200
  );

create policy check_in_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'check-in-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ── deleting an account ──────────────────────────────────────────────────────────────────────────────────

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  -- The database cannot delete the files, only the app can, through the Storage API. Refusing here means calling the
  -- function directly can never leave someone's pictures behind with no account to own them.
  if exists (
    select 1 from storage.objects
     where bucket_id = 'check-in-photos'
       and (storage.foldername(name))[1] = caller::text
  ) then
    raise exception 'remove your photos first' using errcode = '55000';
  end if;

  delete from auth.users where id = caller;
end
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
