# Production API image. Build context = repo root:  docker build -f apps/api/Dockerfile .
FROM oven/bun:1.4.2 AS build
WORKDIR /src
COPY . .
RUN bun install --frozen-lockfile --filter '@app/api' \
 && bun run --cwd apps/api build

FROM oven/bun:1.4.2-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
# The database is a separate SurrealDB server (DATABASE_URL=ws://user:pass@host:8000); the image keeps no state.
COPY --from=build /src/apps/api/dist/ ./
USER bun
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Schema (idempotent, before the server starts): bun migrate-cli.js
CMD ["bun", "server.js"]
