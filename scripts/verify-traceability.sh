#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BRANCH="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)"
SHORT_SHA="$(git -C "$ROOT_DIR" rev-parse --short=7 HEAD)"
FULL_SHA="$(git -C "$ROOT_DIR" rev-parse HEAD)"
COMMIT_DATE="$(git -C "$ROOT_DIR" show -s --format=%ci HEAD)"
COMMIT_MSG="$(git -C "$ROOT_DIR" show -s --format=%s HEAD)"

echo "[1/4] Git Commit (Source of Truth)"
echo "  Branch:  ${BRANCH}"
echo "  SHA-7:   ${SHORT_SHA}"
echo "  SHA-40:  ${FULL_SHA}"
echo "  Date:    ${COMMIT_DATE}"
echo "  Subject: ${COMMIT_MSG}"
echo ""

KUSTOMIZE_FILE="$ROOT_DIR/k8s/kustomization.yaml"
BACKEND_MANIFEST="$ROOT_DIR/k8s/base/backend.yaml"
FRONTEND_MANIFEST="$ROOT_DIR/k8s/base/frontend.yaml"
ARGOCD_FILE="$ROOT_DIR/k8s/argocd/application.yaml"

KUST_TAGS="$(grep -E 'newTag:' "$KUSTOMIZE_FILE" | awk '{print $2}' | paste -sd ',' -)"
BACKEND_IMG="$(grep -E 'image:[[:space:]]*kevinmateog/flix-backend:' "$BACKEND_MANIFEST" | awk '{print $2}')"
FRONTEND_IMG="$(grep -E 'image:[[:space:]]*kevinmateog/flix-frontend:' "$FRONTEND_MANIFEST" | awk '{print $2}')"
ARGO_REPO="$(grep -E 'repoURL:' "$ARGOCD_FILE" | awk '{print $2}')"
ARGO_REV="$(grep -E 'targetRevision:' "$ARGOCD_FILE" | awk '{print $2}')"
ARGO_PATH="$(grep -E 'path:' "$ARGOCD_FILE" | awk '{print $2}')"

echo "[2/4] Declarative Kubernetes Manifests (GitOps State)"
echo "  kustomization.yaml tags: ${KUST_TAGS}"
echo "  backend.yaml image:      ${BACKEND_IMG}"
echo "  frontend.yaml image:     ${FRONTEND_IMG}"
echo "  ArgoCD source:           ${ARGO_REPO} (rev=${ARGO_REV}, path=${ARGO_PATH})"

if [[ "$BACKEND_IMG" == *":latest" || "$FRONTEND_IMG" == *":latest" ]]; then
  echo "  Warning: mutable :latest tag detected in manifests."
fi
if [[ "$BACKEND_IMG" != *":sha-${SHORT_SHA}" || "$FRONTEND_IMG" != *":sha-${SHORT_SHA}" ]]; then
  echo "  Note: manifest image tags differ from current HEAD (sha-${SHORT_SHA}); run ./scripts/gitops-promote.sh if promoting HEAD."
fi
echo ""

echo "[3/4] Cluster Runtime State (Minikube / Kubernetes)"
if ! command -v kubectl >/dev/null 2>&1; then
  echo "  Skipped: kubectl is not installed in PATH."
elif ! kubectl cluster-info >/dev/null 2>&1; then
  echo "  Skipped: Kubernetes cluster context is unreachable."
else
  CONTEXT="$(kubectl config current-context 2>/dev/null || echo 'unknown')"
  echo "  Active context: ${CONTEXT}"
  if kubectl get namespace flix >/dev/null 2>&1; then
    kubectl get deploy,pods -n flix
    echo "  Running Pod Images and Digests:"
    kubectl get pods -n flix -o jsonpath='{range .items[*]}{"  - "}{.metadata.name}{" -> image="}{.spec.containers[0].image}{" | imageID="}{.status.containerStatuses[0].imageID}{"\n"}{end}'
  else
    echo "  Namespace 'flix' does not exist yet in the active cluster."
  fi
fi
echo ""

echo "[4/4] ArgoCD Reconciliation Status"
if ! command -v kubectl >/dev/null 2>&1 || ! kubectl cluster-info >/dev/null 2>&1; then
  echo "  Skipped: cluster is unreachable."
elif kubectl get namespace argocd >/dev/null 2>&1 && kubectl get application flix -n argocd >/dev/null 2>&1; then
  kubectl get application flix -n argocd -o jsonpath='{"  Sync Status: "}{.status.sync.status}{"\n  Sync Revision: "}{.status.sync.revision}{"\n  Health Status: "}{.status.health.status}{"\n"}'
else
  echo "  ArgoCD Application 'flix' is not installed in namespace 'argocd'."
fi
