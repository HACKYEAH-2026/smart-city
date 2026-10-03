# Shortcuts for the package.json scripts. Run inside `nix develop` / direnv.

# List recipes
default:
    @just --list

# Install dependencies
install:
    bun install

# API + Expo (+ on-demand benches upload) in one terminal (mprocs.yaml)
dev: install
    mprocs

# API only: in-memory SurrealDB with the "Kraków" demo, :4000
api:
    bun run --cwd apps/api dev

# Expo dev server only, :8081
app:
    bun run --cwd apps/app dev

# Upload a plugin into a running API, e.g. `just plugin plugins/benches krakow`
plugin path community="krakow":
    bun run plugin:upload {{path}} {{community}}

# Lint, types, tests, DB schema, E2E, build (Android in `nix develop .#android`)
verify:
    bun run verify

lint:
    bun run lint

# Apply Biome fixes and formatting
format:
    bun run format

typecheck:
    bun run typecheck

# Unit + integration tests
test:
    bun run test:unit
    bun run test:int

e2e:
    bun run e2e

build:
    bun run build

android:
    bun run android
