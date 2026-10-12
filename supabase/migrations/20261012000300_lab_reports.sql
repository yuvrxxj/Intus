-- Uploaded lab reports: the original PDF, kept private to its owner.
--
-- Same shape as the check-in photos (20261009000200_photo_check_ins.sql):
--   - a private bucket, one folder per person, files named exactly <own user id>/<uuid>.pdf
--   - PDFs only, at most 10 MiB each, at most 200 per person
--   - select, insert and delete only inside the person's own folder, nothing for the signed-out role, no update
--   - delete_my_account() refuses while the caller still has reports, because SQL cannot delete a stored file and the
--     app removes them through the Storage API first
--
-- Only adds a bucket, policies and a function, and replaces delete_my_account() with the same body plus one check.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lab-reports', 'lab-reports', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create schema if not exists private;

create or replace function private.my_lab_report_count()
returns integer
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select count(*)::integer
    from storage.objects o
   where o.bucket_id = 'lab-reports'
     and (storage.foldername(o.name))[1] = (select auth.uid())::text
$$;

revoke all on function private.my_lab_report_count() from public, anon;
grant execute on function private.my_lab_report_count() to authenticated;
grant usage on schema private to authenticated;

drop policy if exists lab_reports_select on storage.objects;
drop policy if exists lab_reports_insert on storage.objects;
drop policy if exists lab_reports_delete on storage.objects;

create policy lab_reports_select on storage.objects for select to authenticated
  using (bucket_id = 'lab-reports' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy lab_reports_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lab-reports'
    and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.pdf$')
    and (select private.my_lab_report_count()) < 200
  );

create policy lab_reports_delete on storage.objects for delete to authenticated
  using (bucket_id = 'lab-reports' and (storage.foldername(name))[1] = (select auth.uid())::text);

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

  -- The database cannot delete stored files, only the app can, through the Storage API. Refusing here means calling
  -- the function directly can never leave someone's pictures or reports behind with no account to own them.
  if exists (
    select 1 from storage.objects
     where bucket_id = 'check-in-photos'
       and (storage.foldername(name))[1] = caller::text
  ) then
    raise exception 'remove your photos first' using errcode = '55000';
  end if;

  if exists (
    select 1 from storage.objects
     where bucket_id = 'lab-reports'
       and (storage.foldername(name))[1] = caller::text
  ) then
    raise exception 'remove your reports first' using errcode = '55000';
  end if;

  delete from auth.users where id = caller;
end
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
