#!/usr/bin/env bash
# Test backupu: migracje + dane -> backup.sh -> restore.sh do NOWEGO pliku -> porównanie danych.
# Wymaga: sqlite3 (devShell).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
SRC="$tmp/src.db"
DST="$tmp/dst.db"

DATABASE_URL="file:$SRC" bun "$root/apps/api/src/db/migrate-cli.ts"
sqlite3 "$SRC" <<'SQL'
insert into "user"(id, name, email, email_verified, created_at, updated_at) values ('u1', 'Backup Test', 'backup@example.test', 0, 0, 0);
insert into notes(id, user_id, title, body, created_at, updated_at) values ('n1', 'u1', 'Notatka z backupu', 'zażółć gęślą jaźń', 0, 0);
SQL

DATABASE_PATH="$SRC" BACKUP_LOCAL_DIR="$tmp/out" sh "$here/backup.sh"
dump="$(ls "$tmp"/out/backup-*.db.gz | head -n 1)"
sh "$here/restore.sh" "$dump" "$DST"

q='select u.email, n.title, n.body from notes n join "user" u on u.id = n.user_id order by n.title'
expected="$(sqlite3 "$SRC" "$q")"
actual="$(sqlite3 "$DST" "$q")"
migrations="$(sqlite3 "$DST" 'select count(*) from __drizzle_migrations')"
if [[ "$expected" != "$actual" || -z "$actual" ]]; then
  echo "backup-test: BŁĄD — dane po odtworzeniu różnią się" >&2
  echo "oczekiwane: $expected" >&2; echo "otrzymane:  $actual" >&2
  exit 1
fi
echo "backup-test: OK — odtworzono '$actual', migracje w bazie docelowej: $migrations"
