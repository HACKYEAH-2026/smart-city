#!/usr/bin/env bash
# Statyczna kontrola infry (etap verify): format + validate każdego środowiska, bez backendu i sekretów.
set -euo pipefail
cd "$(dirname "$0")"
tofu fmt -check -recursive -diff .
for env in envs/*/; do
  tofu -chdir="$env" init -backend=false -input=false -no-color >/dev/null
  tofu -chdir="$env" validate -no-color
done
