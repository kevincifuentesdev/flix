#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILURES=0

fail() {
  echo "  FAIL: $1" >&2
  FAILURES=$((FAILURES + 1))
}

echo "[1/5] Git Tracked Files Check"
TRACKED_SECRETS="$(git -C "$ROOT_DIR" ls-files | grep -E '(^|/)\.env($|\.)|(\.pem|\.key)$' | grep -v '\.env\.example$' || true)"
if [[ -n "$TRACKED_SECRETS" ]]; then
  fail "Sensitive files tracked in Git: ${TRACKED_SECRETS}"
else
  echo "  PASS: No .env, .pem, or .key files tracked in Git."
fi

echo "[2/5] Source & Manifest Secret Scan"
HEX_KEYS="$(grep -rnE "(apiKey|api_key|API_KEY|SECRET|TOKEN|PASSWORD).*[=:][[:space:]]*['\"][a-fA-F0-9]{32,}['\"]" \
  "$ROOT_DIR/backend/src" "$ROOT_DIR/frontend/src" "$ROOT_DIR/frontend/app" "$ROOT_DIR/k8s" 2>/dev/null || true)"
if [[ -n "$HEX_KEYS" ]]; then
  fail "Potential hardcoded secret literal found: ${HEX_KEYS}"
else
  echo "  PASS: No hardcoded 32+ char hex credentials in source or manifests."
fi

PRIVATE_KEYS="$(grep -rnE "BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY" \
  "$ROOT_DIR/backend/src" "$ROOT_DIR/frontend/src" "$ROOT_DIR/k8s" 2>/dev/null || true)"
if [[ -n "$PRIVATE_KEYS" ]]; then
  fail "Private key material found in tracked paths."
else
  echo "  PASS: No private key headers found."
fi

if grep -q "secrets\.example\.yaml" "$ROOT_DIR/k8s/kustomization.yaml"; then
  fail "k8s/kustomization.yaml must not apply secrets.example.yaml."
else
  echo "  PASS: k8s/kustomization.yaml does not apply placeholder Secrets."
fi

echo "[3/5] Docker & Git Ignore Hygiene"
for ignore_file in ".gitignore" "backend/.gitignore" "frontend/.gitignore" "backend/.dockerignore" "frontend/.dockerignore"; do
  if ! grep -q "\.env" "$ROOT_DIR/$ignore_file"; then
    fail "${ignore_file} does not exclude .env files."
  fi
done
echo "  PASS: All .gitignore and .dockerignore files exclude .env files."

echo "[4/5] Container & Kubernetes Hardening"
for dockerfile in "backend/Dockerfile" "frontend/Dockerfile"; do
  if ! grep -qE "^USER[[:space:]]+" "$ROOT_DIR/$dockerfile"; then
    fail "${dockerfile} does not set a non-root USER."
  fi
done

for manifest in "k8s/base/backend.yaml" "k8s/base/frontend.yaml"; do
  if ! grep -q "runAsNonRoot: true" "$ROOT_DIR/$manifest" || ! grep -q "allowPrivilegeEscalation: false" "$ROOT_DIR/$manifest"; then
    fail "${manifest} is missing hardened securityContext settings."
  fi
done
echo "  PASS: Dockerfiles and Kubernetes Deployments enforce non-root execution."

echo "[5/5] Cluster Secret Metadata (Redacted)"
if ! command -v kubectl >/dev/null 2>&1 || ! kubectl cluster-info >/dev/null 2>&1; then
  echo "  Skipped: cluster is unreachable or kubectl is not installed."
elif kubectl get namespace flix >/dev/null 2>&1; then
  kubectl get secrets -n flix -o jsonpath='{range .items[*]}{"  - "}{.metadata.name}{" (type="}{.type}{") keys="}{range $k, $v := .data}{$k}{" "}{end}{"\n"}{end}'
else
  echo "  Namespace 'flix' does not exist yet in the active cluster."
fi

if [[ "$FAILURES" -gt 0 ]]; then
  echo "Security audit failed with ${FAILURES} issue(s)." >&2
  exit 1
fi

echo "Security audit completed with 0 failures."
