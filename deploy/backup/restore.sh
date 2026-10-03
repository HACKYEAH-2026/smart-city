#!/bin/sh
# Odtwarzanie: restore.sh <plik.db.gz | s3-key | latest> <DOCELOWY_PLIK_BAZY>
#   latest   -> najnowszy obiekt z R2 (R2_BUCKET/BACKUP_PREFIX)
#   s3-key   -> klucz w R2, np. staging/backup-20260101T030000Z.db.gz
#   plik     -> lokalna ścieżka
# Zatrzymaj API przed odtwarzaniem do pliku, z którego korzysta (docker compose stop api).
set -eu
src="${1:?podaj plik, klucz s3 albo 'latest'}"
target="${2:?podaj docelowy plik bazy SQLite}"

if [ -f "$src" ]; then
  file="$src"
else
  : "${R2_BUCKET:?R2_BUCKET wymagany dla odtwarzania z R2}"
  if [ "$src" = "latest" ]; then
    src=$(aws s3 ls "s3://$R2_BUCKET/${BACKUP_PREFIX:-backups}/" --endpoint-url "$R2_ENDPOINT" \
      | awk '{print $4}' | sort | tail -n 1)
    src="${BACKUP_PREFIX:-backups}/$src"
  fi
  file="/tmp/restore.db.gz"
  aws s3 cp "s3://$R2_BUCKET/$src" "$file" --endpoint-url "$R2_ENDPOINT" --only-show-errors
fi

tmp="$target.restore-$$"
gunzip -c "$file" > "$tmp"
sqlite3 "$tmp" "pragma integrity_check" | grep -qx ok
rm -f "$target-wal" "$target-shm"
mv "$tmp" "$target"
echo "restore: OK $src -> $target"
