#!/bin/sh
# Restore a backup into a database (use a NEW database first, check it, then switch).
#   PGHOST=… PGUSER=… PGPASSWORD=… ./deploy/restore.sh /backups/souk-20261115-020000.dump target_db
set -eu
file="$1"; target="$2"
createdb "$target"
pg_restore --no-owner --no-privileges --exit-on-error -d "$target" "$file"
psql -d "$target" -tAc "select 'restored: ' || count(*) || ' merchants' from merchants"
