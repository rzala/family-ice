#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# E2E Gate Runner — Single canonical entrypoint
#
# Usage: ./e2e/run-gates.sh [OPTIONS]
#
# Options:
#   --headed     Run in headed browser mode (for local debugging)
#   --ci         Run in CI mode (stricter: forbidOnly, no retries)
#   --seed       Run backend seed script before tests (if configured)
#   --project X  Run only Playwright project X (default: chromium)
#
# Exit codes:
#   0 = PASS (all gate tests passed)
#   1 = FAIL (one or more gate tests failed)
#
# Outputs:
#   verdict.json — Machine-readable verdict with PASS/FAIL + artifact paths
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="$SCRIPT_DIR"
VERDICT_FILE="$E2E_DIR/verdict.json"
RESULTS_FILE="$E2E_DIR/results.json"
CTRF_FILE="$E2E_DIR/ctrf-report.json"
ARTIFACTS_DIR="$E2E_DIR/artifacts"
CONFIG_FILE="$E2E_DIR/e2e.config.json"

HEADED=""
CI_MODE=""
SEED=""
PROJECT=""
EXTRA_PW_ARGS=""

for arg in "$@"; do
  case $arg in
    --headed) HEADED="--headed" ;;
    --ci) CI_MODE="1" ;;
    --seed) SEED="1" ;;
    --project=*) PROJECT="${arg#*=}" ;;
    --grep=*) EXTRA_PW_ARGS="$EXTRA_PW_ARGS --grep=\"${arg#*=}\"" ;;
    --grep) shift_next=1 ;;
    *) [[ "${shift_next:-}" == "1" ]] && EXTRA_PW_ARGS="$EXTRA_PW_ARGS --grep=\"$arg\"" && shift_next="" ;;
  esac
done

# Check config exists
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "[e2e] ERROR: e2e.config.json not found."
  echo "[e2e] Run /speckit.e2e.init to scaffold the E2E framework."
  exit 1
fi

# Check node_modules
if [[ ! -d "$E2E_DIR/node_modules" ]]; then
  echo "[e2e] Installing dependencies..."
  (cd "$E2E_DIR" && npm install)
fi

# Check browsers installed
if ! npx --prefix "$E2E_DIR" playwright install --check chromium 2>/dev/null; then
  echo "[e2e] Installing Chromium..."
  (cd "$E2E_DIR" && npx playwright install --with-deps chromium)
fi

# Seed backend if requested
if [[ -n "$SEED" ]]; then
  SEED_CMD=$(jq -r '.seed.command // empty' "$CONFIG_FILE" 2>/dev/null || true)
  if [[ -n "$SEED_CMD" ]]; then
    echo "[e2e] Seeding backend..."
    eval "$SEED_CMD"
  else
    echo "[e2e] No seed command configured in e2e.config.json"
  fi
fi

# Clean previous artifacts
rm -rf "$ARTIFACTS_DIR" "$RESULTS_FILE" "$CTRF_FILE" "$VERDICT_FILE"

# Build Playwright args
PW_ARGS=""
[[ -n "$HEADED" ]] && PW_ARGS="$PW_ARGS --headed"
[[ -n "$PROJECT" ]] && PW_ARGS="$PW_ARGS --project=$PROJECT"

# Export CI env if in CI mode
if [[ -n "$CI_MODE" ]]; then
  export CI=true
fi

# Ensure DISPLAY is set for headless Chromium on Linux/WSL
export DISPLAY="${DISPLAY:-:0}"

# ============================================================================
# Ephemeral environment lifecycle
# ============================================================================
ENV_MODE=$(jq -r '.environment.mode // "local"' "$CONFIG_FILE" 2>/dev/null || echo "local")
COMPOSE_PROJECT=""
COMPOSE_FILE=""
TEARDOWN_POLICY=""

ephemeral_up() {
  COMPOSE_FILE=$(jq -r '.environment.compose.file // "docker-compose.e2e.yml"' "$CONFIG_FILE")
  local prefix
  prefix=$(jq -r '.environment.compose.projectPrefix // "e2e"' "$CONFIG_FILE")
  local up_timeout
  up_timeout=$(jq -r '.environment.compose.upTimeoutSec // 60' "$CONFIG_FILE")
  TEARDOWN_POLICY=$(jq -r '.environment.teardown // "always"' "$CONFIG_FILE")
  COMPOSE_PROJECT="${prefix}-$(head -c4 /dev/urandom | xxd -p)"

  local compose_path="$E2E_DIR/$COMPOSE_FILE"
  if [[ ! -f "$compose_path" ]]; then
    echo "[e2e] ERROR: Compose file not found: $compose_path"
    echo "[e2e] Run /speckit.e2e.update to generate it."
    exit 1
  fi

  echo "[e2e] Starting ephemeral stack: $COMPOSE_PROJECT"
  docker compose -p "$COMPOSE_PROJECT" -f "$compose_path" up -d --wait --timeout "$up_timeout" 2>&1

  # Run service healthchecks beyond compose healthchecks
  local port_offset
  port_offset=$(jq -r '.environment.compose.portOffset // 100' "$CONFIG_FILE")
  local services
  services=$(jq -r '.environment.services // {} | keys[]' "$CONFIG_FILE" 2>/dev/null || true)
  for svc in $services; do
    local hc
    hc=$(jq -r ".environment.services[\"$svc\"].healthcheck // empty" "$CONFIG_FILE")
    local ready_timeout
    ready_timeout=$(jq -r ".environment.services[\"$svc\"].readyTimeoutMs // 30000" "$CONFIG_FILE")
    if [[ -n "$hc" ]]; then
      # Replace {port} placeholder with offset port
      hc="${hc//\{port\}/$port_offset}"
      echo "[e2e] Waiting for $svc healthcheck: $hc"
      local deadline=$((SECONDS + ready_timeout / 1000))
      while ! curl -sf "$hc" >/dev/null 2>&1; do
        if (( SECONDS >= deadline )); then
          echo "[e2e] ERROR: $svc healthcheck timed out after ${ready_timeout}ms"
          ephemeral_down 1
          exit 1
        fi
        sleep 1
      done
      echo "[e2e] $svc is ready"
    fi
  done

  # Run seed if configured for ephemeral env
  local env_seed_cmd
  env_seed_cmd=$(jq -r '.environment.seed.command // empty' "$CONFIG_FILE" 2>/dev/null || true)
  if [[ -n "$env_seed_cmd" ]]; then
    env_seed_cmd="${env_seed_cmd//\{project\}/$COMPOSE_PROJECT}"
    echo "[e2e] Seeding ephemeral environment..."
    eval "$env_seed_cmd"
  fi
}

ephemeral_down() {
  local exit_code="${1:-0}"
  if [[ -z "$COMPOSE_PROJECT" || -z "$COMPOSE_FILE" ]]; then
    return
  fi

  local should_teardown=0
  case "$TEARDOWN_POLICY" in
    always) should_teardown=1 ;;
    on-pass) [[ "$exit_code" -eq 0 ]] && should_teardown=1 ;;
    never) should_teardown=0 ;;
  esac

  if [[ "$should_teardown" -eq 1 ]]; then
    echo "[e2e] Tearing down ephemeral stack: $COMPOSE_PROJECT"
    docker compose -p "$COMPOSE_PROJECT" -f "$E2E_DIR/$COMPOSE_FILE" down -v 2>&1 || true
  else
    echo "[e2e] Keeping ephemeral stack for debugging: $COMPOSE_PROJECT"
    echo "[e2e] Teardown manually: docker compose -p $COMPOSE_PROJECT -f $E2E_DIR/$COMPOSE_FILE down -v"
  fi
}

# Start ephemeral stack if configured
if [[ "$ENV_MODE" == "ephemeral" || "$ENV_MODE" == "hybrid" ]]; then
  ephemeral_up
  # Override base URL with ephemeral port if port offset is set
  PORT_OFFSET=$(jq -r '.environment.compose.portOffset // 100' "$CONFIG_FILE")
  BASE_PORT=$(jq -r '.urls.baseURL // "http://localhost:3000"' "$CONFIG_FILE" | grep -oP ':\K[0-9]+$' || echo "3000")
  EPHEMERAL_PORT=$((BASE_PORT + PORT_OFFSET))
  export E2E_BASE_URL="http://localhost:${EPHEMERAL_PORT}"
  echo "[e2e] Ephemeral base URL: $E2E_BASE_URL"
fi

# Run Playwright
echo "[e2e] Running gate tests..."
EXIT_CODE=0
(cd "$E2E_DIR" && npx playwright test $PW_ARGS $EXTRA_PW_ARGS 2>&1) || EXIT_CODE=$?

# Tear down ephemeral stack
if [[ "$ENV_MODE" == "ephemeral" || "$ENV_MODE" == "hybrid" ]]; then
  ephemeral_down $EXIT_CODE
fi

# Generate verdict.json
echo "[e2e] Generating verdict..."
(cd "$E2E_DIR" && node generate-verdict.mjs 2>/dev/null) || true

# Print one-line verdict
echo ""
if [[ $EXIT_CODE -eq 0 ]]; then
  echo "PASS"
else
  echo "FAIL"
  if [[ -f "$VERDICT_FILE" ]]; then
    echo "[e2e] Verdict: $VERDICT_FILE"
    echo "[e2e] Artifacts: $ARTIFACTS_DIR/"
  fi
fi

exit $EXIT_CODE
