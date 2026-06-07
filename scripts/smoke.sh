#!/usr/bin/env bash
# smoke.sh — end-to-end smoke test for the RN tvOS app.
#
# Runs the working recipe documented in AGENTS.md:
#   1. xcodebuild build (with codegen-race retry)
#   2. boot the tvOS simulator (if not booted)
#   3. install the app
#   4. start Metro in the background (if not already running)
#   5. launch the app
#   6. assert the JS bundle actually loaded (log probe)
#   7. capture a screenshot artifact
#
# Exit codes:
#   0 - success
#   1 - argument / environment problem
#   2 - native build failed (even after codegen-race retry)
#   3 - simulator boot/install failed
#   4 - app failed to launch
#   5 - JS bundle did not load within timeout (Metro probably wedged)
#
# Usage:
#   ./scripts/smoke.sh
#   ./scripts/smoke.sh --device 'Apple TV 4K (3rd generation)'
#   CI=1 ./scripts/smoke.sh   # extra verbosity, kill Metro on exit
set -euo pipefail

DEVICE_NAME="${DEVICE_NAME:-Apple TV}"
BUNDLE_ID="${BUNDLE_ID:-org.reactjs.native.example.app}"
SCHEME="${SCHEME:-app}"
CONFIGURATION="${CONFIGURATION:-Debug}"
TIMEOUT_LAUNCH_SECS="${TIMEOUT_LAUNCH_SECS:-90}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --device) DEVICE_NAME="$2"; shift 2 ;;
    --bundle-id) BUNDLE_ID="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,18p' "$0"; exit 0 ;;
    *) echo "smoke: unknown arg $1" >&2; exit 1 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$REPO_ROOT/app"
LOG_DIR="$REPO_ROOT/.build-logs"
SHOT_DIR="$REPO_ROOT/docs/screenshots"
mkdir -p "$LOG_DIR" "$SHOT_DIR"

TS="$(date +%Y%m%d-%H%M%S)"
BUILD_LOG="$LOG_DIR/smoke-build-$TS.log"
METRO_LOG="$LOG_DIR/smoke-metro-$TS.log"
SHOT_OUT="$SHOT_DIR/smoke-$TS.png"

WORKSPACE="$APP_DIR/ios/$SCHEME.xcworkspace"
DERIVED="$APP_DIR/ios/build"
APP_BUNDLE="$DERIVED/Build/Products/$CONFIGURATION-appletvsimulator/$SCHEME.app"

cd "$APP_DIR"

# ---------------------------------------------------------------------------
log() { printf '\n=== %s ===\n' "$*"; }

cleanup() {
  local code=$?
  if [[ "${CI:-}" == "1" && -n "${METRO_PID:-}" ]] && kill -0 "$METRO_PID" 2>/dev/null; then
    log "stopping Metro (PID $METRO_PID)"
    kill "$METRO_PID" 2>/dev/null || true
  fi
  return $code
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
log "tooling versions"
xcodebuild -version | head -2
echo "node $(node --version)"
echo "npm $(npm --version)"
ruby --version
pod --version

# ---------------------------------------------------------------------------
log "ensure Pods are installed"
if [[ ! -d ios/Pods ]]; then
  ( cd ios && pod install )
else
  echo "ios/Pods present; skipping pod install (delete to force)"
fi

# ---------------------------------------------------------------------------
log "xcodebuild build (attempt 1)"
set +e
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination "platform=tvOS Simulator,name=$DEVICE_NAME" \
  -derivedDataPath "$DERIVED" \
  build 2>&1 | tee "$BUILD_LOG"
BUILD_RC=${PIPESTATUS[0]}
set -e

if [[ $BUILD_RC -ne 0 ]]; then
  if grep -q "Build input file cannot be found.*ReactCodegen" "$BUILD_LOG"; then
    log "codegen race detected — retrying xcodebuild (attempt 2)"
    set +e
    xcodebuild \
      -workspace "$WORKSPACE" \
      -scheme "$SCHEME" \
      -configuration "$CONFIGURATION" \
      -destination "platform=tvOS Simulator,name=$DEVICE_NAME" \
      -derivedDataPath "$DERIVED" \
      build 2>&1 | tee -a "$BUILD_LOG"
    BUILD_RC=${PIPESTATUS[0]}
    set -e
  fi
fi
if [[ $BUILD_RC -ne 0 ]]; then
  echo "smoke: xcodebuild failed; see $BUILD_LOG" >&2
  exit 2
fi
[[ -d "$APP_BUNDLE" ]] || { echo "smoke: no .app at $APP_BUNDLE" >&2; exit 2; }

# ---------------------------------------------------------------------------
log "boot simulator '$DEVICE_NAME'"
# Idempotent boot: ignore the "Unable to boot device in current state: Booted"
# error which means the device is already running.
BOOT_OUT="$(xcrun simctl boot "$DEVICE_NAME" 2>&1)" || true
if echo "$BOOT_OUT" | grep -q "current state: Booted"; then
  echo "simulator already booted"
elif [[ -z "$BOOT_OUT" ]]; then
  echo "booted"
else
  # Any other output is a real error.
  echo "$BOOT_OUT" >&2
  echo "smoke: failed to boot sim" >&2
  exit 3
fi

# ---------------------------------------------------------------------------
log "install app"
xcrun simctl install booted "$APP_BUNDLE" || { echo "smoke: install failed" >&2; exit 3; }

# ---------------------------------------------------------------------------
log "ensure Metro is running"
if ! curl -fsS http://localhost:8081/status -m 2 >/dev/null 2>&1; then
  echo "starting Metro in background -> $METRO_LOG"
  ( nohup npx react-native start --reset-cache > "$METRO_LOG" 2>&1 </dev/null & echo $! > "$LOG_DIR/.metro.pid" )
  METRO_PID="$(cat "$LOG_DIR/.metro.pid")"
  for i in {1..30}; do
    if curl -fsS http://localhost:8081/status -m 2 >/dev/null 2>&1; then
      echo "Metro ready after ${i}s (PID $METRO_PID)"
      break
    fi
    sleep 1
  done
  if ! curl -fsS http://localhost:8081/status -m 2 >/dev/null 2>&1; then
    echo "smoke: Metro did not become ready in 30s" >&2; exit 5
  fi
else
  echo "Metro already listening on :8081; reusing"
fi

# ---------------------------------------------------------------------------
log "launch app"
LAUNCH_OUT="$(xcrun simctl launch booted "$BUNDLE_ID" 2>&1)" \
  || { echo "smoke: launch failed: $LAUNCH_OUT" >&2; exit 4; }
echo "$LAUNCH_OUT"
LAUNCH_PID="$(echo "$LAUNCH_OUT" | awk '{print $2}')"

# ---------------------------------------------------------------------------
log "probe for JS bundle load (timeout ${TIMEOUT_LAUNCH_SECS}s)"
# We want to catch THREE failure shapes:
#   1. `Running "app"` — RN's own log line when the bundle starts
#      executing. Catches "JS bundle didn't load at all".
#   2. `M3: <id> setup resolved` — ComponentHost logs this once the
#      mounted component's setup() promise has resolved. Catches
#      "JS loaded but setup() crashed / fetch never completed".
#   3. `M3: <id> layout=["..."]` — ComponentHost logs this on the
#      first render where state is resolved AND render() returned
#      at least one primitive. Catches "ComponentHost mounted, setup
#      resolved, but render() returned []" — the silent-blank-screen
#      failure mode unit tests don't see because they all use
#      components that return non-empty layouts.
PROBE_LOG="$LOG_DIR/smoke-jsprobe-$TS.log"
DEADLINE=$(( $(date +%s) + TIMEOUT_LAUNCH_SECS ))
JS_LOADED=0
SETUP_RESOLVED=0
LAYOUT_RENDERED=0
while [[ $(date +%s) -lt $DEADLINE ]]; do
  xcrun simctl spawn booted log show \
      --predicate 'processImagePath CONTAINS "/app.app/"' \
      --last 2m --info --debug 2>/dev/null > "$PROBE_LOG" || true
  if [[ $JS_LOADED -ne 1 ]] && grep -q 'Running "app"' "$PROBE_LOG"; then
    JS_LOADED=1
  fi
  if grep -qE 'M3: .* setup resolved' "$PROBE_LOG"; then
    SETUP_RESOLVED=1
  fi
  # Require layout=["..."] — at least one quoted primitive type entry.
  if grep -qE 'M3: .* layout=\["[a-z]+' "$PROBE_LOG"; then
    LAYOUT_RENDERED=1
  fi
  if [[ $JS_LOADED -eq 1 && $SETUP_RESOLVED -eq 1 && $LAYOUT_RENDERED -eq 1 ]]; then
    break
  fi
  sleep 2
done
if [[ $JS_LOADED -ne 1 || $SETUP_RESOLVED -ne 1 || $LAYOUT_RENDERED -ne 1 ]]; then
  echo "smoke: failed within ${TIMEOUT_LAUNCH_SECS}s — JS_LOADED=$JS_LOADED SETUP_RESOLVED=$SETUP_RESOLVED LAYOUT_RENDERED=$LAYOUT_RENDERED" >&2
  echo "--- last 50 lines of simulator log for our app ---" >&2
  tail -50 "$PROBE_LOG" >&2 || true
  echo "--- metro log tail ---" >&2
  tail -50 "$METRO_LOG" 2>/dev/null >&2 || true
  exit 5
fi
echo "JS bundle loaded ✓"
echo "Component setup resolved ✓"
echo "Layout rendered with primitives ✓"

# ---------------------------------------------------------------------------
log "screenshot"
sleep 2   # let one frame settle
xcrun simctl io booted screenshot "$SHOT_OUT"
echo "wrote $SHOT_OUT"

log "smoke OK"
echo "build log:      $BUILD_LOG"
echo "metro log:      $METRO_LOG"
echo "screenshot:     $SHOT_OUT"
echo "launch PID:     ${LAUNCH_PID:-?}"
