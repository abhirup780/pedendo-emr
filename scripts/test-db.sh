#!/usr/bin/env bash
# Runs the database tests against a throwaway Postgres and PostgREST (the same server Supabase
# puts in front of Postgres), with every migration applied. Nothing here touches Supabase.
#
#   npm run test:db
#
# Needs PostgreSQL server binaries on this machine. PostgREST is downloaded once into
# node_modules/.cache if it is not already on the PATH. Linux x64 only.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)}
[ -x "$PGBIN/initdb" ] || PGBIN=$(pg_config --bindir 2>/dev/null || true)
[ -x "$PGBIN/initdb" ] || { echo "PostgreSQL server binaries not found. Install postgresql, or set PGBIN."; exit 1; }

WORK=${PGTEST_DIR:-$(mktemp -d)}
PGPORT=${PGTEST_PORT:-54340}
APIPORT=${PGTEST_API_PORT:-54341}
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

cleanup() {
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
  as_pg "$PGBIN/pg_ctl -D $WORK/data -m immediate stop" >/dev/null 2>&1 || true
}
trap cleanup EXIT

as_pg "$PGBIN/initdb -D $WORK/data -U postgres -A trust" >/dev/null
as_pg "$PGBIN/pg_ctl -D $WORK/data -o '-p $PGPORT -c listen_addresses=localhost -c unix_socket_directories=' -l $WORK/postgres.log -w start" >/dev/null

PSQL="psql -h localhost -p $PGPORT -U postgres -q -v ON_ERROR_STOP=1"
$PSQL -f "$ROOT/tests/db/setup.sql"
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

cd "$ROOT"
TEST_PGRST_URL="http://localhost:$APIPORT" TEST_JWT_SECRET=$SECRET TEST_PSQL="$PSQL" npx vitest run tests/db "$@"
