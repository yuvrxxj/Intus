-- Lets a signed-in person delete their own account from the app.
--
-- The browser cannot delete a row in auth.users with the public key, and the service key must never ship in the
-- app, so the deletion is a function the person calls through the API (/rest/v1/rpc/delete_my_account). It runs
-- with its owner's rights ("security definer"), but it takes no arguments and only ever removes the row of the
-- caller, read from their login token. Nobody can use it on anyone else.
--
-- Removing the auth.users row removes everything that hangs off it, because each of those tables references
-- auth.users with "on delete cascade": every personal table (including habits), app_owner, and Supabase's own
-- identities, sessions, refresh tokens and MFA factors. Anything added later that stores a person's data must do
-- the same; the database tests fail if a table with a user_id column does not.
--
-- This function lives in "public" on purpose, unlike private.is_owner(): it has to be callable through the API.
-- search_path is empty so nothing can be swapped in under the names it uses, and every name in it is qualified.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  delete from auth.users where id = caller;
end
$$;

-- Supabase hands new functions to anon and authenticated by default. Only a signed-in person may call this one.
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
