#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV="${ROOT_DIR}/backend/.env"
FRONTEND_ENV="${ROOT_DIR}/frontend/.env"
NAMESPACE="flix"
MODE="--check"

if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [--check | --apply]" >&2
  exit 1
fi

if [[ $# -eq 1 ]]; then
  case "$1" in
    --check|--apply)
      MODE="$1"
      ;;
    *)
      echo "Unknown option: $1. Use --check or --apply." >&2
      exit 1
      ;;
  esac
fi

# Read a key from an env file without evaluating shell expansions or printing values.
read_env_value() {
  local file="$1"
  local key="$2"
  if [[ ! -f "$file" ]]; then
    return 0
  fi
  local line
  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    return 0
  fi
  local val="${line#*=}"
  val="${val%$'\r'}"
  if [[ "$val" =~ ^\"(.*)\"$ ]]; then
    val="${BASH_REMATCH[1]}"
  elif [[ "$val" =~ ^\'(.*)\'$ ]]; then
    val="${BASH_REMATCH[1]}"
  fi
  printf '%s' "$val"
}

report_key() {
  local label="$1"
  local value="$2"
  if [[ -n "$value" ]]; then
    printf "  %-26s present (redacted, %d chars)\n" "${label}:" "${#value}"
  else
    printf "  %-26s missing\n" "${label}:"
  fi
}

PG_DB="$(read_env_value "$BACKEND_ENV" "POSTGRES_DB")"
PG_DB="${PG_DB:-flix}"
PG_USER="$(read_env_value "$BACKEND_ENV" "POSTGRES_USER")"
PG_USER="${PG_USER:-flix_user}"
PG_PASS="$(read_env_value "$BACKEND_ENV" "POSTGRES_PASSWORD")"

RAW_DB_URL="$(read_env_value "$BACKEND_ENV" "DATABASE_URL")"
if [[ -n "$PG_PASS" ]]; then
  CLUSTER_DB_URL="postgresql://${PG_USER}:${PG_PASS}@flix-postgres:5432/${PG_DB}"
else
  CLUSTER_DB_URL="$RAW_DB_URL"
fi

BETTER_AUTH_SECRET="$(read_env_value "$BACKEND_ENV" "BETTER_AUTH_SECRET")"
BACKEND_TMDB_KEY="$(read_env_value "$BACKEND_ENV" "TMDB_API_KEY")"
TMDB_READ_TOKEN="$(read_env_value "$BACKEND_ENV" "TMDB_READ_ACCESS_TOKEN")"
MUX_TOKEN_ID="$(read_env_value "$BACKEND_ENV" "MUX_TOKEN_ID")"
MUX_TOKEN_SECRET="$(read_env_value "$BACKEND_ENV" "MUX_TOKEN_SECRET")"
AWS_ENDPOINT="$(read_env_value "$BACKEND_ENV" "AWS_ENDPOINT_URL_S3")"
AWS_KEY_ID="$(read_env_value "$BACKEND_ENV" "AWS_ACCESS_KEY_ID")"
AWS_SECRET_KEY="$(read_env_value "$BACKEND_ENV" "AWS_SECRET_ACCESS_KEY")"

FRONTEND_TMDB_KEY="$(read_env_value "$FRONTEND_ENV" "TMDB_API_KEY")"
FRONTEND_TMDB_KEY="${FRONTEND_TMDB_KEY:-$BACKEND_TMDB_KEY}"

if [[ "$MODE" == "--check" ]]; then
  echo "Checking local secret definitions (values redacted):"
  echo "[flix-postgres-secret]"
  report_key "POSTGRES_PASSWORD" "$PG_PASS"
  echo "[flix-backend-secret]"
  report_key "DATABASE_URL" "$CLUSTER_DB_URL"
  report_key "BETTER_AUTH_SECRET" "$BETTER_AUTH_SECRET"
  report_key "TMDB_API_KEY" "$BACKEND_TMDB_KEY"
  report_key "TMDB_READ_ACCESS_TOKEN" "$TMDB_READ_TOKEN"
  report_key "MUX_TOKEN_ID" "$MUX_TOKEN_ID"
  report_key "MUX_TOKEN_SECRET" "$MUX_TOKEN_SECRET"
  report_key "AWS_ENDPOINT_URL_S3" "$AWS_ENDPOINT"
  report_key "AWS_ACCESS_KEY_ID" "$AWS_KEY_ID"
  report_key "AWS_SECRET_ACCESS_KEY" "$AWS_SECRET_KEY"
  echo "[flix-frontend-secret]"
  report_key "TMDB_API_KEY" "$FRONTEND_TMDB_KEY"
  exit 0
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "Error: kubectl is required for --apply mode." >&2
  exit 1
fi

if ! kubectl cluster-info >/dev/null 2>&1; then
  echo "Error: Kubernetes cluster is unreachable." >&2
  exit 1
fi

if [[ -z "$PG_PASS" || -z "$CLUSTER_DB_URL" || -z "$BETTER_AUTH_SECRET" ]]; then
  echo "Error: POSTGRES_PASSWORD, DATABASE_URL, and BETTER_AUTH_SECRET are required in backend/.env." >&2
  exit 1
fi

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - >/dev/null

kubectl create secret generic flix-postgres-secret \
  --namespace="$NAMESPACE" \
  --from-literal=POSTGRES_PASSWORD="$PG_PASS" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic flix-backend-secret \
  --namespace="$NAMESPACE" \
  --from-literal=DATABASE_URL="$CLUSTER_DB_URL" \
  --from-literal=BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
  --from-literal=TMDB_API_KEY="$BACKEND_TMDB_KEY" \
  --from-literal=TMDB_READ_ACCESS_TOKEN="$TMDB_READ_TOKEN" \
  --from-literal=MUX_TOKEN_ID="$MUX_TOKEN_ID" \
  --from-literal=MUX_TOKEN_SECRET="$MUX_TOKEN_SECRET" \
  --from-literal=AWS_ENDPOINT_URL_S3="$AWS_ENDPOINT" \
  --from-literal=AWS_ACCESS_KEY_ID="$AWS_KEY_ID" \
  --from-literal=AWS_SECRET_ACCESS_KEY="$AWS_SECRET_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic flix-frontend-secret \
  --namespace="$NAMESPACE" \
  --from-literal=TMDB_API_KEY="$FRONTEND_TMDB_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Secrets applied safely to namespace '${NAMESPACE}' without exposing values."
