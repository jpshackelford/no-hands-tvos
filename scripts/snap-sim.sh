#!/usr/bin/env bash
# snap-sim.sh — capture a screenshot of the running tvOS Simulator.
#
# Three modes:
#   ./scripts/snap-sim.sh                 -> raw display (1920x1080), no chrome
#   ./scripts/snap-sim.sh --window        -> Simulator window WITH chrome
#   ./scripts/snap-sim.sh --window --keep-shadow
#                                         -> window with chrome AND drop shadow
#
# Output:
#   docs/screenshots/sim-YYYYMMDD-HHMMSS.png
#   (or pass an explicit path as the last argument)
set -euo pipefail

MODE="raw"
KEEP_SHADOW=0
OUT=""

for arg in "$@"; do
  case "$arg" in
    --window) MODE="window" ;;
    --keep-shadow) KEEP_SHADOW=1 ;;
    -h|--help)
      sed -n '2,15p' "$0"; exit 0 ;;
    *) OUT="$arg" ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[[ -z "$OUT" ]] && OUT="$REPO_ROOT/docs/screenshots/sim-$(date +%Y%m%d-%H%M%S).png"
mkdir -p "$(dirname "$OUT")"

case "$MODE" in
  raw)
    xcrun simctl io booted screenshot "$OUT"
    ;;
  window)
    # Find Simulator's CoreGraphics window ID via a tiny Swift script.
    # Avoids needing GetWindowID, Quartz/PyObjC, or osascript Accessibility access.
    WID=$(swift - <<'SWIFT'
import Cocoa
let opts: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
guard let windows = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String: Any]] else { exit(1) }
for w in windows {
    let owner = w[kCGWindowOwnerName as String] as? String ?? ""
    let layer = w[kCGWindowLayer as String] as? Int ?? 99
    let bounds = w[kCGWindowBounds as String] as? [String: CGFloat] ?? [:]
    if owner == "Simulator" && layer == 0 && (bounds["Height"] ?? 0) > 200 {
        print(w[kCGWindowNumber as String] as? Int ?? 0); exit(0)
    }
}
exit(2)
SWIFT
)
    if [[ -z "$WID" ]]; then
      echo "snap-sim: could not find Simulator window. Is the Simulator app open?" >&2
      exit 1
    fi
    # Bring it forward so the capture isn't behind another window.
    osascript -e 'tell application "Simulator" to activate' >/dev/null 2>&1 || true
    sleep 0.5
    if [[ "$KEEP_SHADOW" == "1" ]]; then
      screencapture -l "$WID" -t png "$OUT"
    else
      screencapture -o -l "$WID" -t png "$OUT"
    fi
    ;;
esac

echo "$OUT"
