#!/bin/sh
# Spójna kopia bazy SQLite (sqlite3 .backup działa przy pracującym API, także w trybie WAL)
# -> R2 (gdy R2_BUCKET ustawiony) lub katalog lokalny (BACKUP_LOCAL_DIR).
# Retencja w R2: reguła lifecycle bucketa (infra/modules/app). Lokalnie: BACKUP_RETENTION_DAYS.
set -eu
: "${DATABASE_PATH:?DATABASE_PATH wymagany (plik bazy SQLite)}"
ts=$(date -u +%Y%m%dT%H%M%SZ)
file="/tmp/backup-$ts.db"
sqlite3 "$DATABASE_PATH" ".backup '$file'"
sqlite3 "$file" "pragma integrity_check" | grep -qx ok
gzip "$file"
file="$file.gz"
size=$(wc -c < "$file" | tr -d ' ')

if [ -n "${R2_BUCKET:-}" ]; then
  : "${R2_ENDPOINT:?R2_ENDPOINT wymagany}"
  key="${BACKUP_PREFIX:-backups}/backup-$ts.db.gz"
  aws s3 cp "$file" "s3://$R2_BUCKET/$key" --endpoint-url "$R2_ENDPOINT" --only-show-errors
  echo "backup: OK s3://$R2_BUCKET/$key ($size B)"
elif [ -n "${BACKUP_LOCAL_DIR:-}" ]; then
  mkdir -p "$BACKUP_LOCAL_DIR"
  mv "$file" "$BACKUP_LOCAL_DIR/"
  find "$BACKUP_LOCAL_DIR" -name 'backup-*.db.gz' -mtime +"${BACKUP_RETENTION_DAYS:-14}" -delete
  echo "backup: OK $BACKUP_LOCAL_DIR/backup-$ts.db.gz ($size B)"
  exit 0
else
  echo "backup: BŁĄD — ustaw R2_BUCKET albo BACKUP_LOCAL_DIR" >&2
  exit 1
fi
rm -f "$file"
