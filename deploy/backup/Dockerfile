# Kontener backupu: spójna kopia SQLite (.backup) co noc -> R2. Kontekst builda: deploy/backup
FROM alpine:3.22
RUN apk add --no-cache sqlite aws-cli
COPY backup.sh restore.sh entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
