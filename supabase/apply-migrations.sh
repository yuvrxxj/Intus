#!/usr/bin/env bash
# Applies the files in supabase/migrations that the database has not seen yet, oldest first.
#
#   DATABASE_URL=postgresql://... bash supabase/apply-migrations.sh            apply what is pending
#   DATABASE_URL=postgresql://... bash supabase/apply-migrations.sh --dry-run  list what is pending, change nothing
#
# Each file runs in its own transaction together with the line that records it, so a file lands completely or
# not at all, and a file that failed is simply tried again next time. Files listed in baseline.txt were applied
# by hand before this script existed and are never run again. Everything else is tracked in
# supabase_migrations.repo_migrations, a table the API cannot reach.
#
# Use the session-pooler connection string (Supabase dashboard, Connect). The direct one is IPv6 only and
# GitHub's runners cannot reach it.
set -euo pipefail
export LC_ALL=C

: "${DATABASE_URL:?DATABASE_URL is not set. Add the repository secret SUPABASE_DB_URL (see supabase/README.md).}"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
migrations_dir="${MIGRATIONS_DIR:-$here/migrations}"
baseline_file="${BASELINE_FILE:-$here/baseline.txt}"
dry_run=false
[ "${1:-}" = "--dry-run" ] && dry_run=true

sql() { PGOPTIONS="-c client_min_messages=warning" psql "$DATABASE_URL" -X -q -At -v ON_ERROR_STOP=1 "$@"; }

if ! $dry_run; then
  sql <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.repo_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);
alter table supabase_migrations.repo_migrations enable row level security;
SQL
fi

in_baseline() { grep -qxF -- "$1" "$baseline_file"; }

recorded() {
  # a dry run on a database that has never been touched has no table yet: nothing is recorded
  [ "$(sql -c "select to_regclass('supabase_migrations.repo_migrations') is not null")" = "t" ] || return 1
  [ -n "$(sql -v f="$1" <<<"select 1 from supabase_migrations.repo_migrations where filename = :'f'")" ]
}

pending=0
shopt -s nullglob
for path in "$migrations_dir"/*.sql; do
  file="$(basename "$path")"
  if in_baseline "$file" || recorded "$file"; then continue; fi
  pending=$((pending + 1))
  if $dry_run; then
    echo "pending: $file"
    continue
  fi
  echo "applying: $file"
  script="$(mktemp)"
  { cat "$path"; printf '\ninsert into supabase_migrations.repo_migrations (filename) values (:'"'"'f'"'"');\n'; } >"$script"
  if ! sql --single-transaction -v f="$file" -f "$script"; then
    rm -f "$script"
    echo "FAILED: $file (rolled back, nothing from it was kept)" >&2
    exit 1
  fi
  rm -f "$script"
done

if [ "$pending" -eq 0 ]; then echo "nothing to apply"; fi
