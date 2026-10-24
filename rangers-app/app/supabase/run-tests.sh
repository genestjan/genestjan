#!/usr/bin/env bash
# Runs the migrations and the database tests on a throwaway local Postgres.
# Usage: PGHOST=/tmp PGPORT=5544 PGUSER=postgres bash run-tests.sh
# Exits non-zero if any migration errors or any test fails.
set -euo pipefail
cd "$(dirname "$0")"
status=0
for t in rls notify; do
  db="rangers_test_$$_$t"
  createdb "$db"
  psql -q -v ON_ERROR_STOP=1 -d "$db" -f tests/00_stub.sql >/dev/null
  for f in migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$f" >/dev/null; done
  out=$(psql -q -v ON_ERROR_STOP=1 -d "$db" -f "tests/$t.sql" 2>&1) || status=1
  echo "$out" | grep -E '\| FAIL' || true
  echo "$out" | tail -1
  dropdb --if-exists "$db"
done
exit $status
