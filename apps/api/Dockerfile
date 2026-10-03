# Obraz produkcyjny API. Kontekst builda = root repo:  docker build -f apps/api/Dockerfile .
FROM oven/bun:1.4.2 AS build
WORKDIR /src
COPY . .
RUN bun install --frozen-lockfile --filter '@app/api' \
 && bun run --cwd apps/api build

FROM oven/bun:1.4.2-slim
WORKDIR /app
ENV NODE_ENV=production \
    MIGRATIONS_DIR=/app/migrations \
    PORT=3000
COPY --from=build /src/apps/api/dist/ ./
COPY --from=build /src/packages/db/migrations ./migrations
# Plik bazy SQLite żyje na wolumenie /data (docker-compose); nowy wolumen dziedziczy właściciela z obrazu.
RUN mkdir -p /data && chown bun:bun /data
VOLUME /data
USER bun
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Migracje: docker compose run --rm migrate  (bun migrate-cli.js)
CMD ["bun", "server.js"]
