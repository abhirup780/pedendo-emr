#!/usr/bin/env bash
# Runs the database tests against a throwaway Postgres with every migration applied, behind the
# same two servers Supabase puts in front of it: PostgREST (data) and Supabase Auth (sign-in,
# passwords, authenticator codes). Nothing here touches the real Supabase project.
#
#   npm run test:db
#   PGTEST_RUN="command" npm run test:db    (run something else against the same servers)
#
# Needs PostgreSQL server binaries on this machine. PostgREST and Supabase Auth are downloaded
# once into node_modules/.cache if they are not already on the PATH. Linux x64 only.
# File storage is not run here; tests/db/setup.sql has a stand-in for its tables.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)}
[ -x "$PGBIN/initdb" ] || PGBIN=$(pg_config --bindir 2>/dev/null || true)
[ -x "$PGBIN/initdb" ] || { echo "PostgreSQL server binaries not found. Install postgresql, or set PGBIN."; exit 1; }

WORK=${PGTEST_DIR:-$(mktemp -d)}
PGPORT=${PGTEST_PORT:-54340}
APIPORT=${PGTEST_API_PORT:-54341}
AUTHPORT=${PGTEST_AUTH_PORT:-54342}
SECRET=local-test-secret-that-is-at-least-32-chars-long
mkdir -p "$WORK"; rm -rf "$WORK/data"

# Postgres refuses to run as root, so hand the work to the postgres user in that case.
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
[ "$(id -u)" = 0 ] && chown -R postgres "$WORK"

POSTGREST=$(command -v postgrest || true)
if [ -z "$POSTGREST" ]; then
  CACHE="$ROOT/node_modules/.cache/postgrest"; POSTGREST="$CACHE/postgrest"
  if [ ! -x "$POSTGREST" ]; then
    mkdir -p "$CACHE"
    curl -sSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | tar -xJ -C "$CACHE"
  fi
fi

AUTH=$(command -v gotrue || true)
if [ -z "$AUTH" ]; then
  CACHE="$ROOT/node_modules/.cache/supabase-auth"; AUTH="$CACHE/auth"
  if [ ! -x "$AUTH" ]; then
    mkdir -p "$CACHE"
    curl -sSL https://github.com/supabase/auth/releases/download/v2.177.0/auth-v2.177.0-x86.tar.gz | tar -xz -C "$CACHE"
  fi
fi
AUTHDIR=$(dirname "$AUTH")

cleanup() {
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "${AUTH_PID:-}" ] && kill "$AUTH_PID" 2>/dev/null || true
  as_pg "$PGBIN/pg_ctl -D $WORK/data -m immediate stop" >/dev/null 2>&1 || true
}
trap cleanup EXIT

as_pg "$PGBIN/initdb -D $WORK/data -U postgres -A trust" >/dev/null
as_pg "$PGBIN/pg_ctl -D $WORK/data -o '-p $PGPORT -c listen_addresses=localhost -c unix_socket_directories=' -l $WORK/postgres.log -w start" >/dev/null

# Quiet the "does not exist, skipping" notes from drop ... if exists.
export PGOPTIONS="--client-min-messages=warning"
PSQL="psql -h localhost -p $PGPORT -U postgres -q -v ON_ERROR_STOP=1"
$PSQL -f "$ROOT/tests/db/setup.sql"

# Supabase Auth builds its own tables first (the app's migrations refer to auth.users), exactly
# as it has already done in a new Supabase project. Sign-ups are off, as they will be in use:
# accounts are made the way the dashboard's "Add user" makes them.
export GOTRUE_DB_DRIVER=postgres DATABASE_URL="postgres://supabase_auth_admin:auth@localhost:$PGPORT/postgres" \
  GOTRUE_DB_MIGRATIONS_PATH="$AUTHDIR/migrations" GOTRUE_JWT_SECRET=$SECRET GOTRUE_JWT_EXP=3600 \
  GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role \
  GOTRUE_SITE_URL="http://localhost:$AUTHPORT" API_EXTERNAL_URL="http://localhost:$AUTHPORT" \
  GOTRUE_API_HOST=localhost PORT=$AUTHPORT GOTRUE_DISABLE_SIGNUP=true GOTRUE_MAILER_AUTOCONFIRM=true \
  GOTRUE_MFA_TOTP_ENROLL_ENABLED=true GOTRUE_MFA_TOTP_VERIFY_ENABLED=true GOTRUE_RATE_LIMIT_VERIFY=100000 \
  GOTRUE_RATE_LIMIT_TOKEN_REFRESH=100000 GOTRUE_LOG_LEVEL=warn
(cd "$AUTHDIR" && "$AUTH" migrate) >"$WORK/auth-migrate.log" 2>&1 || { echo "Supabase Auth could not prepare its tables:"; cat "$WORK/auth-migrate.log"; exit 1; }

for m in "$ROOT"/supabase/migrations/*.sql; do $PSQL -f "$m"; done
echo "Applied $(ls "$ROOT"/supabase/migrations/*.sql | wc -l) migrations."

PGRST_DB_URI="postgres://authenticator:authenticator@localhost:$PGPORT/postgres" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
  PGRST_JWT_SECRET=$SECRET PGRST_SERVER_PORT=$APIPORT "$POSTGREST" >"$WORK/postgrest.log" 2>&1 &
API_PID=$!
# Wait until PostgREST has read the database layout, not merely opened its port: while it is
# still loading it answers 503 ("Could not query the database for the schema cache"), and
# tests started then fail at random. Up to 30 seconds, then stop with its log.
ready=""
for _ in $(seq 1 120); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$APIPORT/")" = "200" ]; then ready=1; break; fi
  sleep 0.25
done
if [ -z "$ready" ]; then echo "PostgREST did not become ready:"; cat "$WORK/postgrest.log"; exit 1; fi

(cd "$AUTHDIR" && exec "$AUTH" serve) >"$WORK/auth.log" 2>&1 &
AUTH_PID=$!
ready=""
for _ in $(seq 1 120); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$AUTHPORT/health")" = "200" ]; then ready=1; break; fi
  sleep 0.25
done
if [ -z "$ready" ]; then echo "Supabase Auth did not become ready:"; cat "$WORK/auth.log"; exit 1; fi

cd "$ROOT"
# PGTEST_RUN="some command" runs that instead of the tests, with both servers up (for trying
# the built app in a browser against them); it gets the same TEST_* variables.
if [ -n "${PGTEST_RUN:-}" ]; then
  TEST_AUTH_URL="http://localhost:$AUTHPORT" TEST_PGRST_URL="http://localhost:$APIPORT" TEST_JWT_SECRET=$SECRET TEST_PSQL="$PSQL" bash -c "$PGTEST_RUN"
  exit $?
fi
TEST_AUTH_URL="http://localhost:$AUTHPORT" TEST_PGRST_URL="http://localhost:$APIPORT" TEST_JWT_SECRET=$SECRET TEST_PSQL="$PSQL" npx vitest run tests/db "$@"
