#!/bin/sh
# Runs once, when the Postgres data volume is first created.
# Creates the least-privilege runtime role the API connects as. Its table
# privileges are granted by the `runtime_role` migration.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$POSTGRES_APP_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE sba_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sba_app')
\gexec
SQL
