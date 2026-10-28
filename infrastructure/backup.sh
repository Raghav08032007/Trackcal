#!/bin/sh
# Run from repository root. Backups contain private records; use encrypted off-host storage.
set -eu
umask 077
directory=${1:-backups}
mkdir -p "$directory"
file="$directory/trackcal-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
temporary="$file.partial"
raw="$file.sql.partial"
trap 'rm -f "$temporary" "$raw"' EXIT
docker compose --env-file .env.production -f compose.production.yml exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -u root --single-transaction --routines --triggers --no-tablespaces trackcal' > "$raw"
grep -q 'CREATE TABLE' "$raw" || { echo 'No schema found; backup rejected.' >&2; exit 1; }
gzip -c "$raw" > "$temporary"
gzip -t "$temporary"
mv "$temporary" "$file"
printf 'Backup written to %s. Verify restoration in an isolated environment.\n' "$file"
