#!/usr/bin/env bash
set -euo pipefail

for command in kustomize mktemp mkdir cp diff grep rm; do
  command -v "$command" >/dev/null || { echo "Error: $command is required" >&2; exit 1; }
done
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/ops/k8s/taico" "$WORK/ops/k8s/taico-steph"
printf 'production must stay untouched\n' > "$WORK/ops/k8s/taico/sentinel"
printf 'other apps must stay untouched\n' > "$WORK/ops/k8s/taico-steph/sentinel"
cp -R "$WORK/ops/k8s/taico" "$WORK/production-before"
cp -R "$WORK/ops/k8s/taico-steph" "$WORK/tenant-before"

bash "$ROOT/scripts/prepare-deployment.sh" live main-test123 "$WORK/ops"
diff -r "$WORK/production-before" "$WORK/ops/k8s/taico"
diff -r "$WORK/tenant-before" "$WORK/ops/k8s/taico-steph"
kustomize build "$WORK/ops/k8s/taico-live/overlays/main" > "$WORK/live.yaml"
grep -Fq 'namespace: taico-live' "$WORK/live.yaml"
grep -Fq 'https://live.taico.app' "$WORK/live.yaml"
grep -Fq 'ai-monorepo:main-test123' "$WORK/live.yaml"
grep -Fq 'port: 15436' "$WORK/live.yaml"
if grep -Eq 'namespace: taico$|hostname: taico.app$|name: taico-aliases|hostPath:' "$WORK/live.yaml"; then
  echo 'Error: live contains production routing or storage' >&2
  exit 1
fi
cp -R "$WORK/ops/k8s/taico-live" "$WORK/live-before"

bash "$ROOT/scripts/prepare-deployment.sh" production 0.11.4 "$WORK/ops"
diff -r "$WORK/live-before" "$WORK/ops/k8s/taico-live"
diff -r "$WORK/tenant-before" "$WORK/ops/k8s/taico-steph"
kustomize build "$WORK/ops/k8s/taico/overlays/main" > "$WORK/production.yaml"
grep -Fq 'namespace: taico' "$WORK/production.yaml"
grep -Fq 'ai-monorepo:0.11.4' "$WORK/production.yaml"
grep -Fq 'hostname: taico.app' "$WORK/production.yaml"
if grep -Fq 'live.taico.app' "$WORK/production.yaml"; then
  echo 'Error: production contains live routing' >&2
  exit 1
fi
echo 'Deployment isolation checks passed'
