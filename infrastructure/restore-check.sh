#!/bin/sh
# Restore ONLY into a fresh disposable MySQL container, never the production database.
set -eu
archive=${1:?Usage: restore-check.sh path/to/backup.sql.gz}
[ -f "$archive" ] || exit 1
gzip -t "$archive"
name="trackcal-restore-check-$(python3 -c 'import uuid; print(uuid.uuid4().hex)')"
password=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
created=false
trap 'if [ "$created" = true ]; then docker rm -f "$name" >/dev/null 2>&1 || true; fi' EXIT
docker run -d --name "$name" --network none -e MYSQL_ROOT_PASSWORD="$password" -e MYSQL_DATABASE=trackcal mysql:8.4 >/dev/null
created=true
attempt=0
until docker exec -e MYSQL_PWD="$password" "$name" mysqladmin ping -u root --silent >/dev/null 2>&1; do
  attempt=$((attempt+1)); [ "$attempt" -lt 60 ] || exit 1; sleep 2
done
gzip -dc "$archive" | docker exec -i -e MYSQL_PWD="$password" "$name" mysql -u root trackcal
docker exec -e MYSQL_PWD="$password" "$name" mysql -u root -N -e 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema="trackcal"; SELECT COUNT(*) FROM trackcal.users; SELECT COUNT(*) FROM trackcal.user_workspaces;'
echo 'Disposable restoration completed. Compare counts with the backup manifest before approving recovery.'
