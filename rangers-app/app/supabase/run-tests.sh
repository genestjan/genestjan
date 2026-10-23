#!/usr/bin/env bash
# Runs the migrations and access tests on a throwaway local Postgres.
# Usage: PGHOST=/tmp PGPORT=5544 PGUSER=postgres ./run-tests.sh
set -euo pipefail
cd "$(dirname "$0")"
for t in rls notify; do
  db=rangers_test_$$_$t
  createdb "$db"
  psql -q -v ON_ERROR_STOP=1 -d "$db" -f tests/00_stub.sql >/dev/null
  for f in migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$f" >/dev/null; done
  psql -q -v ON_ERROR_STOP=1 -d "$db" -f tests/$t.sql | tail -1 || { dropdb --if-exists "$db"; exit 3; }
  dropdb --if-exists "$db"
done
