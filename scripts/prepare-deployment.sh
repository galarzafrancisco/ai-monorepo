#!/usr/bin/env bash
set -euo pipefail

for command in cp mkdir rm kustomize; do
  command -v "$command" >/dev/null || { echo "Error: $command is required" >&2; exit 1; }
done

ENVIRONMENT="${1:?Usage: prepare-deployment.sh live|production IMAGE_TAG SPARK_OPS_DIR}"
IMAGE_TAG="${2:?Image tag is required}"
OPS_DIR="${3:?spark-ops checkout is required}"
SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../install/manifests" && pwd)"
case "$ENVIRONMENT" in
  live) SERVICE=taico-live; OVERLAY=live ;;
  production) SERVICE=taico; OVERLAY=main ;;
  *) echo "Error: unknown environment $ENVIRONMENT" >&2; exit 1 ;;
esac
[[ -d "$OPS_DIR/k8s" ]] || { echo "Error: not a spark-ops checkout: $OPS_DIR" >&2; exit 1; }
[[ -f "$SOURCE/overlays/$OVERLAY/kustomization.yaml" ]] || {
  echo "Error: missing $OVERLAY overlay" >&2; exit 1;
}

# Each environment owns its own base. A main build must never replace the
# production base, even when both environments use the same resource names.
TARGET="$OPS_DIR/k8s/$SERVICE"
rm -rf "$TARGET"
mkdir -p "$TARGET/overlays/main"
cp -R "$SOURCE/base" "$TARGET/base"
cp -R "$SOURCE/overlays/$OVERLAY/." "$TARGET/overlays/main/"
(
  cd "$TARGET/base"
  kustomize edit set image "ghcr.io/galarzafrancisco/ai-monorepo=ghcr.io/galarzafrancisco/ai-monorepo:$IMAGE_TAG"
)
