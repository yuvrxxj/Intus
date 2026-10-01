-- Tables created from now on start closed to the signed-out role.
--
-- Supabase gives anon (and authenticated) full privileges on every new table in public, and a new table
-- has row level security off. Without this, the next table anyone adds would be readable and writable by
-- anyone holding the public key until someone remembers to lock it. The tables that exist today were
-- already revoked by 20261001000200_owner_lockdown.sql.
--
-- A new table still needs row level security and an owner policy before the signed-in role is let in.

alter default privileges in schema public revoke all on tables from anon;
