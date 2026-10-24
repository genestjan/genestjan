#!/usr/bin/env bash
# Starts a throwaway local Supabase-like stack for integration tests:
#   Postgres (an existing local server, $PGHOST/$PGPORT, trust auth), GoTrue (auth), PostgREST, Mailpit (catches sign-in emails), gateway.
# Usage: PGHOST=127.0.0.1 PGPORT=5544 PGUSER=postgres bash start.sh     Stop: bash start.sh stop
set -euo pipefail
cd "$(dirname "$0")"
DB=rangers_live
if [ "${1:-}" = "stop" ]; then docker rm -f rs-gotrue rs-postgrest rs-mailpit >/dev/null 2>&1 || true; { [ -f /tmp/rs-gateway.pid ] && kill "$(cat /tmp/rs-gateway.pid)" 2>/dev/null; } || true; rm -f /tmp/rs-gateway.pid; exit 0; fi
bash "$0" stop
dropdb --if-exists "$DB"; createdb "$DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator login noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin login superuser; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;
-- what Supabase sets up for tables and functions created in public
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create schema if not exists auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role;
SQL
SECRET=$(node -e "import('./keys.mjs').then(m=>console.log(m.JWT_SECRET))")
docker run -d --name rs-mailpit --network host axllent/mailpit:v1.20 >/dev/null
docker run -d --name rs-gotrue --network host \
  -e GOTRUE_API_HOST=127.0.0.1 -e PORT=9999 -e API_EXTERNAL_URL=http://localhost:54321/auth/v1 \
  -e GOTRUE_DB_DRIVER=postgres -e "GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin@127.0.0.1:${PGPORT:-5432}/$DB?sslmode=disable&search_path=auth" \
  -e GOTRUE_SITE_URL=http://localhost:4400/app/ -e 'GOTRUE_URI_ALLOW_LIST=*' -e GOTRUE_JWT_SECRET="$SECRET" -e GOTRUE_JWT_EXP=3600 \
  -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated -e GOTRUE_JWT_ADMIN_ROLES=service_role \
  -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=false -e GOTRUE_DISABLE_SIGNUP=false \
  -e GOTRUE_SMTP_HOST=127.0.0.1 -e GOTRUE_SMTP_PORT=1025 -e GOTRUE_SMTP_ADMIN_EMAIL=no-reply@rangersfc.net -e GOTRUE_SMTP_SENDER_NAME="Rangers FC" \
  -e GOTRUE_MAILER_TEMPLATES_MAGIC_LINK=http://127.0.0.1:54321/templates/otp.html -e GOTRUE_MAILER_TEMPLATES_CONFIRMATION=http://127.0.0.1:54321/templates/otp.html \
  -e GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 -e GOTRUE_SMTP_MAX_FREQUENCY=1s -e GOTRUE_MAILER_OTP_EXP=3600 -e GOTRUE_EXTERNAL_PHONE_ENABLED=false \
  supabase/gotrue:v2.177.0 >/dev/null
nohup node gateway.mjs >/tmp/rs-gateway.log 2>&1 &
echo $! > /tmp/rs-gateway.pid
for i in $(seq 1 60); do curl -fsS http://127.0.0.1:9999/health >/dev/null 2>&1 && break; sleep 1; done
curl -fsS http://127.0.0.1:9999/health >/dev/null || { docker logs rs-gotrue | tail -30; exit 1; }
# GoTrue has created the auth schema; now the app's own migrations
for f in ../migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" >/dev/null; done
docker run -d --name rs-postgrest --network host \
  -e "PGRST_DB_URI=postgres://authenticator@127.0.0.1:${PGPORT:-5432}/$DB" -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET="$SECRET" -e PGRST_SERVER_PORT=3000 -e PGRST_DB_CHANNEL_ENABLED=true \
  postgrest/postgrest:v12.2.3 >/dev/null
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:3000/ >/dev/null 2>&1 && break; sleep 1; done
echo "stack up: gateway http://localhost:54321  mail http://localhost:8025"
