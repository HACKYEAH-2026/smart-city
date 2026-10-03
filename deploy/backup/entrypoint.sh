#!/bin/sh
# busybox crond nie przekazuje środowiska kontenera, więc zapisujemy je do pliku.
set -eu
env | grep -E '^(DATABASE_URL|R2_|AWS_|BACKUP_)' | sed 's/^/export /; s/=/="/; s/$/"/' > /etc/backup.env
echo "${BACKUP_SCHEDULE:-0 3 * * *} . /etc/backup.env && /usr/local/bin/backup.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "backup: harmonogram '${BACKUP_SCHEDULE:-0 3 * * *}'"
exec crond -f -l 8
