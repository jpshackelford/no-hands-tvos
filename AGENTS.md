# AGENTS.md — no-hands-tvos

Persistent context for AI agents working in this repo.

## What this repo is

Proof-of-concept for the **No-Hands.dev universal component framework on tvOS**.
Four sequential milestones (issues #1–#4); see README.md.

Sibling project: `jpshackelford/voice-relay` (TS monorepo, kiosk display lives there as `client/src/components/KioskMode.tsx`). voice-relay code is NOT shared with this PoC — this repo validates whether a future shared component runtime is feasible on Apple TV.

## Tooling baseline (verified Jun 2026)

- macOS 15.6 Sequoia, Apple Silicon
- Xcode 26.3 (build 17C529) → `/Applications/Xcode.app`
- tvOS 26.2 Simulator runtime installed; sim devices: `Apple TV 4K (3rd generation)`, `Apple TV 4K (3rd generation) (at 1080p)`, `Apple TV` (HD)
- Node 22.19, npm 10.9
- watchman (brewed)
- CocoaPods 1.16.2 (brewed; brings its own Ruby 4.0; system Ruby 2.6.10 is too old for current pods)
- SwiftLint 0.63, xcbeautify 3.2 (brewed)

## App stack (after `npm install`)

- `react-native-tvos@0.83.0-0` (tracks RN 0.83) — installed as `"react-native": "npm:react-native-tvos@..."` in `app/package.json`. **Do not also install `react-native` core** — fork must be the only one.
- React 19.2.0
- New Architecture (Fabric) ON by default
- Hermes JS engine
- tvOS deployment target 15.1
- Bundle ID: `org.reactjs.native.example.app` (template default; rename if/when shipping)

## Repo layout

```
no-hands-tvos/
├── README.md                  # vision, milestones, hypothesis
├── AGENTS.md                  # this file
├── .gitignore                 # excludes .build-logs/
├── app/                       # the RN tvOS project (template-tv)
│   ├── App.tsx                # currently renders "Hello from tvOS"
│   ├── ios/
│   │   ├── app.xcworkspace    # ← always open this, NOT .xcodeproj
│   │   ├── Podfile            # platform :tvos, single target
│   │   └── build/             # gitignored
│   ├── ios/Pods/              # gitignored
│   └── node_modules/          # gitignored
└── docs/screenshots/          # PR/issue evidence
```

## Build & run (the working recipe)

```sh
cd app
npm install
cd ios && pod install && cd ..

xcrun simctl boot "Apple TV"
open -a Simulator

# First build will fail with codegen race — see Gotchas. Just run twice.
xcodebuild -workspace ios/app.xcworkspace -scheme app \
  -configuration Debug \
  -destination 'platform=tvOS Simulator,name=Apple TV' \
  -derivedDataPath ios/build build

# Metro (background; macOS has no setsid, so use subshell):
( nohup npx react-native start > ../.build-logs/metro.log 2>&1 </dev/null & )

xcrun simctl install booted ios/build/Build/Products/Debug-appletvsimulator/app.app
xcrun simctl launch booted org.reactjs.native.example.app
```

Pipe xcodebuild through `xcbeautify --renderer terminal` for readable output.
Capture full log via `tee ../.build-logs/build.log` for grepping errors.

Screenshot for evidence: `xcrun simctl io booted screenshot path.png`.

## Gotchas (re-learn these and you'll waste hours)

1. **Codegen race in RN 0.83.** First `xcodebuild build` fails with `Build input file cannot be found: …/ReactCodegen/RCTThirdPartyComponentsProvider.mm` and similar. The codegen build phase generates these files; the compile step starts before they're written. **Workaround: run the build twice.** Tracking: may be fixed in 0.85/0.86.

2. **`run-tvos` CLI extension does not exist** despite what the `react-native-tvos` README claims. There is no `@react-native-tvos/cli-platform-tvos` or `@react-native-tvos/cli` npm package. `react-native run-ios` will pick an iOS sim, not the tvOS one. **Use `xcodebuild` + `simctl` directly.**

3. **`Platform.OS === 'ios'` on tvOS.** Use `Platform.isTVOS` to distinguish Apple TV.

4. **CocoaPods is still required** even though `pod install` prints a deprecation notice telling you to use Expo/Community CLI instead. Both alternatives don't apply here.

5. **Background processes on macOS.** `setsid` is not installed; use `( nohup CMD > log 2>&1 </dev/null & )` subshell pattern. Plain `&` from a non-interactive shell tends to leave the process in stopped (T) state.

6. **Don't commit `app/Pods/`, `app/build/`, `app/node_modules/`, `ios/build/`.** Template `.gitignore` already handles them.

## React Native tvOS focus engine reminders (for Milestone 2)

- `Pressable`, `TouchableOpacity`, `TouchableHighlight` work with focus events out of the box.
- `TouchableNativeFeedback` and `TouchableWithoutFeedback` do not respond to focus and should not be used on TV.
- `onFocus` / `onBlur` are native core events on TV; they bubble through `View` components.
- `useTVEventHandler(handler)` for low-level Siri Remote events.
- The very first frame may log `UIFocus: Failed to update focus … No additional info available.` — this is expected before any focusable view exists.

## Useful one-liners

```sh
# tvOS sim devices
xcrun simctl list devices available | grep -A1 "tvOS"

# Boot if not booted
xcrun simctl boot "Apple TV" 2>/dev/null

# Tail app logs
xcrun simctl spawn booted log stream --predicate 'processImagePath CONTAINS "/app.app/"' --info

# Reset simulator state
xcrun simctl erase "Apple TV"
```

## Branching / PR conventions

- Branch per milestone: `milestone-N-short-name`
- PRs are draft by default; user marks ready themselves
- Always `Closes #N` in the PR body for the corresponding milestone issue
- Disclose AI authorship in PR body and any issue comments (e.g. *"This PR was prepared by an AI agent (OpenHands) on behalf of @jpshackelford."*)

---

## Agent working environment

Notes specifically about how to operate effectively in this user's setup — what
tools exist, what's gated, and the patterns that have actually worked.

### Visual feedback (what does the simulator look like right now?)

The user expects to see screenshots, not just log excerpts. Three capture
modes, in escalating quality:

1. **Raw display content** (no chrome, 1920×1080):
   `xcrun simctl io booted screenshot path.png`
   Fastest, zero dependencies, no permissions. Use this for iteration.
2. **Window with chrome** (matches what the user sees): use
   `./scripts/snap-sim.sh --window path.png` — finds the Simulator's
   CoreGraphics window ID via a small inline Swift program, then runs
   `screencapture -o -l <wid>`. No `osascript` Accessibility grant required for
   the window-id lookup itself (Swift's CGWindowListCopyWindowInfo is
   unrestricted). The script also runs `osascript -e 'tell app "Simulator" to
   activate'` to bring it forward, which **does** need Accessibility — granted
   2026-06-06 for `osascript`.
3. **Region capture via AppleScript bounds** (`screencapture -R x,y,w,h`) —
   works but produces slight bleed past the window edges. Prefer mode 2.

After saving, view via `file_editor command=view path=<file>` to see the image
inline in the chat.

### Process management on macOS

- `setsid` is NOT installed. Don't use it.
- `cmd &` from a tool-invoked shell tends to leave the process in `T` (Stopped)
  state because the controlling terminal goes away. The job listens on its
  port but never responds.
- **Reliable detach pattern:**
  `( nohup cmd > log 2>&1 </dev/null & )`
  The subshell parens detach the job from job control entirely. Verified
  working for Metro.
- Always check `ps aux | grep ...` afterwards — look for `S` (sleeping/idle)
  not `T` (stopped).
- Don't `pkill -f node` or similar broad patterns — the user has many node
  processes (LM Studio, Bun, etc.). Always kill by PID found from a targeted
  `ps`/`lsof` lookup.

### sudo

`sudo -n true` returns 1: passwordless sudo is NOT configured. Anything
needing sudo (e.g. `xcode-select -s`, `xcodebuild -license accept`) must be
given to the user to paste into their own terminal. Bundle related sudo
commands together so they only need to enter the password once.

### Build iteration loop (the cheap inner loop)

Metro hot-reloads JS. You do NOT need to rebuild the native app for JS-only
changes.

```sh
# One-time per session:
( nohup npx react-native start > ../.build-logs/metro.log 2>&1 </dev/null & )
xcrun simctl launch booted org.reactjs.native.example.app

# Iterate:
# 1. edit App.tsx (or any JS file)
# 2. ./scripts/snap-sim.sh --window docs/screenshots/iter-X.png
# 3. view the PNG, decide next change
```

Only rebuild via `xcodebuild` when:
- Native code (`.m`, `.mm`, `.swift`, `.h`) changes
- `Podfile` or `package.json` native deps change
- You see a red-screen "JS bundle stale" message that survives a Cmd+R

### Reading simulator logs

```sh
# One-shot (recent activity):
xcrun simctl spawn booted log show \
  --predicate 'processImagePath CONTAINS "/app.app/"' \
  --last 1m --info | tail -80

# Live stream (for debugging hangs):
xcrun simctl spawn booted log stream \
  --predicate 'processImagePath CONTAINS "/app.app/"' \
  --info --debug
```

Look for `[com.facebook.react.log:javascript]` lines — those are
`console.log()` from the JS side.

### Reaching GitHub

`gh` CLI is authenticated and works. Prefer `gh issue view N --json …` over
the default colored output: the ANSI control codes from `gh`'s default
renderer are nearly unreadable when piped through the tool result back to the
agent.

### Brew / Homebrew

- `brew` is on PATH at `/opt/homebrew` (Apple Silicon prefix).
- Homebrew 5.1.x emits a lot of "TAP_TRUST" deprecation noise — ignore.
- Bottle installs are fast; `brew install` for things with formulae like
  `swiftlint` actually requires `Xcode.app` (not just CLT), so any pre-Xcode
  attempts to install it will fail.

### Repo layout outside this directory

- All cloned repos live under `~/code/jpshackelford/`
- agent-canvas session dir (`/Users/jpshack/workspace/project/<uuid>`) is
  ephemeral — do NOT put long-lived work there

### Agent Canvas UI panels

The user sees the right-side panel only when explicitly told. Call
`canvas_ui`:
- `navigate_to_file` for a single file edit
- `show_preview` for an image/PDF (e.g. screenshots)
- `open_tab tab=files` after multi-file edits (diff view)
- `open_tab tab=terminal` to surface a long log
- `open_tab tab=tasklist` after task list updates

### Things that have wasted time so far

- Trying `react-native run-ios` thinking it would pick the tvOS sim (it
  doesn't — see Gotcha #2 above)
- Trying to install SwiftLint before Xcode.app existed
- Trying to install Xcode itself headlessly (no fully unattended path; App
  Store with prior auth is simplest)
- Using bare `&` instead of subshell-detached `( ... & )` for Metro
- Asking `gh issue view` without `--json` and getting an ANSI soup back

### Tests & CI

- **Unit tests** live in `app/__tests__/`. Run with `npm test` (Jest + react-test-renderer).
  - `jest.setup.js` inlines a `react-native-safe-area-context` mock because
    the package's own jest mock is ESM and the RN preset doesn't transform it.
- **Lint**: `npm run lint` (`@react-native` ESLint config).
- **Typecheck**: `npm run typecheck` (`tsc --noEmit`).
- **End-to-end smoke**: `./scripts/smoke.sh` from repo root. Builds (with
  codegen-race retry), boots a tvOS sim, installs the app, ensures Metro is
  running, launches, probes for the `Running "app"` JS log line, and captures
  a screenshot. Exit codes 0–5 documented in the script header.
- **CI**: `.github/workflows/ci.yml`. Two jobs:
  1. `js` on `ubuntu-latest`: lint + typecheck + Jest. Cheap, fast, gates the
     macOS job.
  2. `tvos-smoke` on `macos-15`: needs `js`. Installs tvOS sim runtime if
     missing, creates an Apple TV device if missing, caches Pods and
     DerivedData, then runs `scripts/smoke.sh --device <picked>`. Uploads the
     screenshot artifact always; uploads `.build-logs/` on failure.
- **Why no Vitest**: the RN ecosystem (preset, `@testing-library/react-native`,
  every native module's jest mock, Detox/Maestro integrations) assumes Jest.
  Reimplementing the `react-native` Jest preset for Vitest is a 1–2 day
  project that adds no value for a PoC. Revisit only if/when we have a large
  body of framework-agnostic logic.

### Tooling installed during 2026-06-06 setup session

| Tool | Source | Notes |
|---|---|---|
| `xcbeautify` 3.2.1 | brew | Renders xcodebuild output readable |
| `watchman` 2026.06.01 | brew | Metro file watcher |
| `swiftlint` 0.63.3 | brew | Needs Xcode.app present |
| `cocoapods` 1.16.2_2 | brew | Brings its own Ruby 4.0; bypasses old system Ruby |
| Xcode | App Store | 26.3 / build 17C529 |
| tvOS 26.2 sim | `xcodebuild -downloadPlatform tvOS` | ~3 GB |
