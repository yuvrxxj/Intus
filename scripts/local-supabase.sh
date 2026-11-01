#!/usr/bin/env bash
# A local Supabase stack for testing, mainly the iPhone app (INT-166). It never touches production: there is no
# `supabase link`, and every command runs against the containers on this machine. Needs Docker and the Supabase CLI.
#
#   bash scripts/local-supabase.sh start   start the stack; on a fresh database, load the schema
#   bash scripts/local-supabase.sh reset   wipe the local database and load the schema again
#   bash scripts/local-supabase.sh env     print the two lines that point the iPhone app at the local stack
#   bash scripts/local-supabase.sh stop    stop the stack (the data is kept until the next reset)
#
# The first migrations change tables production had before migrations existed, so `supabase start` alone cannot
# build the schema (config.toml turns its own migration run off). On an empty database this loads the same starting
# point the database tests use, supabase/tests/fixtures/pre-lockdown.sql. Then it applies the files in
# supabase/migrations that are not recorded yet, oldest first, each in one transaction with the line that records it,
# as supabase/apply-migrations.sh does on production. Unlike production nothing is skipped as baseline: an empty
# database needs every file. So a later `start` also picks up migrations merged since.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
project_id="$(sed -n 's/^project_id = "\(.*\)"$/\1/p' supabase/config.toml)"
db="supabase_db_${project_id}"

# Production got its owner by hand before the lockdown migration, which refuses to run without one. Locally a
# placeholder login stands in for that step and is deleted once every migration has run.
PLACEHOLDER_OWNER='00000000-0000-4000-8000-00000000c0de'

psql_local() { PGOPTIONS='-c client_min_messages=warning' docker exec -i -e PGOPTIONS "$db" psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

load_schema() {
  psql_local <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.repo_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);
alter table supabase_migrations.repo_migrations enable row level security;
SQL
  if [ "$(psql_local -At -c 'select count(*) from supabase_migrations.repo_migrations')" = 0 ]; then
    echo "Loading the tables production had before migrations"
    psql_local -1 < supabase/tests/fixtures/pre-lockdown.sql
  fi
  local applied=0 path file
  for path in supabase/migrations/*.sql; do
    file="$(basename "$path")"
    if [ -n "$(psql_local -At -c "select 1 from supabase_migrations.repo_migrations where filename = '$file'")" ]; then continue; fi
    echo "  applying $file"
    {
      if [ "$file" = 20261001000200_owner_lockdown.sql ]; then
        echo "insert into auth.users (id, email, aud, role) values ('$PLACEHOLDER_OWNER', 'owner@intus.local', 'authenticated', 'authenticated') on conflict do nothing;"
        echo "insert into public.app_owner (user_id) values ('$PLACEHOLDER_OWNER') on conflict do nothing;"
      fi
      cat "$path"
      printf "\ninsert into supabase_migrations.repo_migrations (filename) values ('%s');\n" "$file"
    } | psql_local -1
    applied=$((applied + 1))
  done
  psql_local -c "delete from auth.users where id = '$PLACEHOLDER_OWNER';"
  if [ "$applied" -eq 0 ]; then echo "The schema is up to date."; else echo "Applied $applied migration files."; fi
}

print_env() {
  supabase status -o env 2>/dev/null | awk -F= '
    $1 == "API_URL" { gsub(/"/, "", $2); print "EXPO_PUBLIC_SUPABASE_URL=" $2 }
    $1 == "PUBLISHABLE_KEY" || ($1 == "ANON_KEY" && !seen) { gsub(/"/, "", $2); key = $2; seen = ($1 == "PUBLISHABLE_KEY") }
    END { print "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=" key }'
}

case "${1:-}" in
  start)
    supabase start
    load_schema
    echo
    echo "Confirmation emails land in the local inbox: http://127.0.0.1:54324"
    echo "Point the iPhone app at this stack with:"
    print_env
    ;;
  reset)
    supabase db reset --local --no-seed
    load_schema
    ;;
  env)
    print_env
    ;;
  stop)
    supabase stop
    ;;
  *)
    sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
