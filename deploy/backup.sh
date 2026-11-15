#!/bin/sh
# Daily PostgreSQL backup with rotation. Runs inside the db-backup container (see docker-compose.prod.yml),
# or by hand: PGHOST=… PGUSER=… PGPASSWORD=… PGDATABASE=… BACKUP_DIR=… ./deploy/backup.sh --once
# Custom format (-Fc): compressed, restorable table by table with pg_restore.
set -eu
BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
INTERVAL_S="${BACKUP_INTERVAL_S:-86400}"

run_once() {
  mkdir -p "$BACKUP_DIR"
  file="$BACKUP_DIR/souk-$(date -u +%Y%m%d-%H%M%S).dump"
  # Write to a temp name first so a crash never leaves a truncated file that looks valid
  pg_dump -Fc --no-owner --no-privileges -f "$file.part"
  pg_restore --list "$file.part" > /dev/null   # integrity check: the archive must be readable
  mv "$file.part" "$file"
  find "$BACKUP_DIR" -name 'souk-*.dump' -mtime +"$KEEP_DAYS" -delete
  echo "$(date -u +%FT%TZ) backup ok: $file ($(du -h "$file" | cut -f1))"
  # Optional off-site copy (strongly recommended): any command that receives the file path,
  # e.g. BACKUP_UPLOAD_CMD='rclone copy {} remote:souk-backups'
  if [ -n "${BACKUP_UPLOAD_CMD:-}" ]; then
    sh -c "$(echo "$BACKUP_UPLOAD_CMD" | sed "s#{}#$file#g")"
  fi
}

if [ "${1:-}" = "--once" ]; then run_once; exit 0; fi
while true; do
  run_once || echo "$(date -u +%FT%TZ) BACKUP FAILED" >&2
  sleep "$INTERVAL_S"
done
