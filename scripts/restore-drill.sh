#!/usr/bin/env bash
# Restore drill: load a `wrangler d1 export` dump into a throwaway local D1 and
# check it, without touching the development database or production.
#
# The deploy workflow exports production D1 before applying migrations and keeps
# the dump as a run artifact (14 days). A backup nobody has restored is only a
# hope, so run this against a recent artifact before a risky release:
#
#   gh run download <run-id> -n d1-backup-<sha> -D /tmp/d1
#   scripts/restore-drill.sh /tmp/d1/pre-migration-<sha>.sql
#
# A second argument overrides the scratch persistence directory.

set -euo pipefail

dump=${1:?usage: scripts/restore-drill.sh <pre-migration.sql> [persist-dir]}
persist=${2:-.wrangler/restore-drill}

if [ ! -f "$dump" ]; then
  echo "no such dump: $dump" >&2
  exit 1
fi

echo "==> Loading $dump into a scratch local D1 at $persist"
rm -rf "$persist"
mkdir -p "$persist"
ordered="$persist/dump-ordered.sql"
python3 scripts/dump-order.py "$dump" "$ordered"
# D1 enforces foreign keys statement by statement and cannot disable them, so a
# dump straight from `d1 export` fails when an early table's rows arrive before
# a later parent table. dump-order.py rewrites the order without changing SQL.
npx wrangler d1 execute church-members-db --local --persist-to "$persist" --file "$ordered" >/dev/null

query() {
  npx wrangler d1 execute church-members-db --local --persist-to "$persist" \
    --json --command "$1" | jq -r '.[0].results[0] | to_entries | map(.value) | @tsv'
}

echo "==> Row counts from the restored copy"
query "SELECT (SELECT COUNT(*) FROM d1_migrations) AS migrations,
              (SELECT COUNT(*) FROM users) AS users,
              (SELECT COUNT(*) FROM members) AS members,
              (SELECT COUNT(*) FROM pastors) AS pastors,
              (SELECT COUNT(*) FROM member_positions) AS positions" |
  awk -F'\t' '{printf "migrations=%s users=%s members=%s pastors=%s positions=%s\n", $1, $2, $3, $4, $5}'

echo "==> Foreign keys"
orphans=$(npx wrangler d1 execute church-members-db --local --persist-to "$persist" \
  --json --command "PRAGMA foreign_key_check" | jq '.[0].results | length')
if [ "$orphans" != "0" ]; then
  echo "foreign_key_check reported $orphans orphaned row(s)" >&2
  exit 1
fi

echo "==> Schema migration recorded by the dump"
query "SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1"

echo
echo "Restore drill passed. The scratch copy is at $persist and can be deleted."
