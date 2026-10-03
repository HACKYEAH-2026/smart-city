# Shortcuts for the package.json scripts. Run inside `nix develop` / direnv.

# mprocs from nix is `mprocs`; Homebrew's mprocs 0.10+ ships it as `dekit` (legacy CLI: `dekit mprocs`)
mprocs := `command -v mprocs >/dev/null && echo mprocs || (command -v dekit >/dev/null && echo "dekit mprocs") || echo mprocs`

# List recipes
default:
    @just --list

# Install dependencies
install:
    bun install

# API + Expo + USB port forwarding in one terminal (mprocs.yaml)
dev: install
    {{mprocs}}

# iPhone in Expo Go (mprocs.ios.yaml): USB cable with Personal Hotspot on, else Wi-Fi; or `just dev-ios <ip>`
dev-ios ip="": install
    #!/usr/bin/env bash
    set -euo pipefail
    mp="{{mprocs}}"
    if ! command -v "${mp%% *}" >/dev/null; then echo "dev-ios: mprocs not found; run inside nix develop, or: brew install mprocs" >&2; exit 1; fi
    # iOS has no adb reverse; over USB the phone reaches the Mac only through Personal Hotspot ("iPhone USB" port)
    usb_if="$(networksetup -listallhardwareports | awk '/^Hardware Port: iPhone USB/ { getline; print $2; exit }')"
    usb_ip="$([ -n "$usb_if" ] && ipconfig getifaddr "$usb_if" || true)"
    wifi_ip="$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || true)"
    ip="{{ip}}"
    if [ -n "$ip" ]; then via="given address"
    elif [ -n "$usb_ip" ]; then ip="$usb_ip"; via="USB cable (Personal Hotspot)"
    elif [ -n "$wifi_ip" ]; then ip="$wifi_ip"; via="Wi-Fi (phone on the same network)"
    else echo "dev-ios: no address found; connect the iPhone by USB with Personal Hotspot on, or pass one: just dev-ios 192.168.x.y" >&2; exit 1
    fi
    echo "dev-ios: $via: API http://$ip:4000, Metro exp://$ip:8081"
    LAN_IP="$ip" {{mprocs}} --config mprocs.ios.yaml

# API only: in-memory SurrealDB with the "Kraków" demo, :4000
api:
    bun run --cwd apps/api dev

# Expo dev server only, localhost:8081
app:
    bun run --cwd apps/app dev

# Android phone over USB / emulator: adb reverse of the API and Metro ports (keeps running)
usb:
    bun scripts/adb-reverse.ts

# Upload a new plugin into a running API, e.g. `just plugin plugins/<id> krakow`
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
