#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_TAG="sha-$(git -C "$ROOT_DIR" rev-parse --short=7 HEAD)"
TARGET_TAG="${1:-$DEFAULT_TAG}"
TARGET_NAMESPACE="${2:-}"

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

if [[ -n "$TARGET_NAMESPACE" && ! "$TARGET_NAMESPACE" =~ ^[a-z0-9][a-z0-9._-]*$ ]]; then
  echo "Error: invalid Docker Hub namespace '$TARGET_NAMESPACE'. Use your Docker Hub username, not an email." >&2
  exit 1
fi

KUSTOMIZE_FILE="$ROOT_DIR/k8s/kustomization.yaml"
BACKEND_MANIFEST="$ROOT_DIR/k8s/base/backend.yaml"
FRONTEND_MANIFEST="$ROOT_DIR/k8s/base/frontend.yaml"

sed -i -E "s|(newTag:[[:space:]]*).*|\1${TARGET_TAG}|g" "$KUSTOMIZE_FILE"

if [[ -n "$TARGET_NAMESPACE" ]]; then
  sed -i -E "s|([a-z0-9._-]+)(/flix-backend)|${TARGET_NAMESPACE}\2|g" "$KUSTOMIZE_FILE" "$BACKEND_MANIFEST"
  sed -i -E "s|([a-z0-9._-]+)(/flix-frontend)|${TARGET_NAMESPACE}\2|g" "$KUSTOMIZE_FILE" "$FRONTEND_MANIFEST"
fi

sed -i -E "s|(image:[[:space:]]*[^[:space:]]+/flix-backend:).*|\1${TARGET_TAG}|g" "$BACKEND_MANIFEST"
sed -i -E "s|(image:[[:space:]]*[^[:space:]]+/flix-frontend:).*|\1${TARGET_TAG}|g" "$FRONTEND_MANIFEST"

echo "Updated GitOps manifests to immutable tag: ${TARGET_TAG}"
if [[ -n "$TARGET_NAMESPACE" ]]; then
  echo "Updated Docker Hub namespace to: ${TARGET_NAMESPACE}"
fi
echo "Modified files:"
echo "  - k8s/kustomization.yaml"
echo "  - k8s/base/backend.yaml"
echo "  - k8s/base/frontend.yaml"
git -C "$ROOT_DIR" diff --stat k8s/
