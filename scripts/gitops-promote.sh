#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_TAG="sha-$(git -C "$ROOT_DIR" rev-parse --short=7 HEAD)"
TARGET_TAG="${1:-$DEFAULT_TAG}"

if [[ -z "$TARGET_TAG" ]]; then
  echo "Error: target image tag cannot be empty." >&2
  exit 1
fi

if [[ "$TARGET_TAG" == "latest" ]]; then
  echo "Error: mutable tag 'latest' is rejected for GitOps manifests. Use an immutable tag like sha-<commit>." >&2
  exit 1
fi

if [[ ! "$TARGET_TAG" =~ ^[a-zA-Z0-9._-]+$ ]]; then
  echo "Error: invalid image tag '$TARGET_TAG'." >&2
  exit 1
fi

KUSTOMIZE_FILE="$ROOT_DIR/k8s/kustomization.yaml"
BACKEND_MANIFEST="$ROOT_DIR/k8s/base/backend.yaml"
FRONTEND_MANIFEST="$ROOT_DIR/k8s/base/frontend.yaml"

sed -i -E "s|(newTag:[[:space:]]*).*|\1${TARGET_TAG}|g" "$KUSTOMIZE_FILE"
sed -i -E "s|(image:[[:space:]]*kevinmateog/flix-backend:).*|\1${TARGET_TAG}|g" "$BACKEND_MANIFEST"
sed -i -E "s|(image:[[:space:]]*kevinmateog/flix-frontend:).*|\1${TARGET_TAG}|g" "$FRONTEND_MANIFEST"

echo "Updated GitOps manifests to immutable tag: ${TARGET_TAG}"
echo "Modified files:"
echo "  - k8s/kustomization.yaml"
echo "  - k8s/base/backend.yaml"
echo "  - k8s/base/frontend.yaml"
git -C "$ROOT_DIR" diff --stat k8s/
