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

### Operating CI as an agent

Quick reference for working with the CI pipeline. Assumes `gh` CLI is
authenticated.

#### Watching a run

```sh
# Most recent run on the current branch
gh run list --branch "$(git branch --show-current)" --limit 1 \
  --json databaseId,status,conclusion,event

# Per-job status of a specific run
RUN=27072344448
gh run view $RUN --json jobs \
  -q '.jobs[] | "\(.name): \(.status) \(.conclusion // "")"'

# Step-by-step timing (useful for spotting what's slow / where it failed)
gh run view $RUN --json jobs \
  -q '.jobs[] | select(.name | contains("tvOS")) | .steps[]
      | "\(.name): \(.conclusion // "?") \(((.completedAt|fromdateiso8601) - (.startedAt|fromdateiso8601)))s"'

# Tail the logs of failed steps
gh run view $RUN --log-failed | tail -200
```

#### Fetching artifacts to debug

Two artifacts are always produced (success or failure):

- `smoke-screenshot` — the final tvOS sim screenshot
- `smoke-logs` — the `.build-logs/` directory (build log, metro log,
  jsprobe log)

```sh
gh api repos/jpshackelford/no-hands-tvos/actions/runs/$RUN/artifacts \
  -q '.artifacts[] | "\(.name) (\(.size_in_bytes) bytes)"'

mkdir -p /tmp/ci-art && gh run download $RUN --name smoke-logs --dir /tmp/ci-art
# Then inspect /tmp/ci-art/smoke-jsprobe-*.log,
#               /tmp/ci-art/smoke-metro-*.log, etc.
```

When the CI smoke fails at the JS-load probe but the build succeeded, the
metro log and jsprobe log are usually where the answer is.

#### Common CI-specific failure modes (already learned)

| Symptom | Likely cause | Fix |
|---|---|---|
| Artifacts step "succeeds" but nothing is uploaded | Dot-prefixed paths (`.build-logs/`) are skipped by `actions/upload-artifact@v4` unless `include-hidden-files: true` is set | Already set in `ci.yml`. Watch for this on any new dot-dir artifact. |
| `smoke.sh` exit 5 (JS bundle did not load) | Predicate too narrow OR runner is just slow to launch | We now use `processImagePath CONTAINS "/app.app/"` and a 90s timeout. If still hitting, raise `TIMEOUT_LAUNCH_SECS` via workflow `env:` |
| Cache misses two runs in a row even though `Podfile.lock` / `package-lock.json` unchanged | The previous run *failed*, so its `Post Cache *` step didn't save (`actions/cache@v4` default `save-always: false`) | Re-run when fixed. Don't push noise commits — the cache will warm itself on the next legitimately successful run. |
| `xcodebuild` first-attempt failure with `ReactCodegen` input missing | The RN 0.83 codegen race — same one we hit locally | `smoke.sh` already retries once. If it persists past retry, the build genuinely broke. |

#### Decoding cache behavior in CI logs

```sh
gh run view $RUN --log 2>&1 | grep -iE \
  'cache hit|cache miss|cache not found|cache restored|cache saved' \
  | head -20
```

A 0–1s `Cache CocoaPods` or `Cache DerivedData` step almost always means
**miss**, not a fast hit (real hits take 10–60s for restoration). Look for
the explicit "Cache hit" / "Cache not found" lines to be sure.

#### When to push vs. when to investigate

- **Don't push noise commits just to "kick" CI.** GitHub doesn't punish
  unsuccessful runs and the cache state isn't repaired by extra pushes.
- **Do** push a real change when CI is broken in a way that needs editing
  the workflow or `smoke.sh`. Always include the diagnostic data in the
  commit message (which artifact log proved what).
- **Cancellation:** `concurrency` is set to cancel-in-progress for the same
  ref, so rapid-fire pushes during iteration automatically discard older
  runs. Use this — don't manually cancel via the UI.

#### Triggering CI

CI runs on `push` to `main` and `pull_request` against `main`. **Pushing to
a feature branch does NOT trigger CI by itself** — open or update a PR. The
PR branch's runs use the PR event (`event: pull_request`), so when polling
via `gh run list`, filter on the branch *and* the event if disambiguation is
needed.

#### What not to put in CI without thinking

- **OCR or image-diff verification of the screenshot.** Tempting, but
  flaky and slow. The current shape (build + launch + probe + screenshot
  artifact for human review) is a better cost/value point for a PoC.
- **Detox / Maestro E2E.** Worth it starting Milestone 2 where there's
  actual UI to assert against. Adds significant setup time; don't bring
  in until needed.
- **Release-mode (Hermes precompiled) builds.** Debug + Metro is what we
  run today. Adding Release-mode builds later validates the eventual
  shipping path but doubles the macOS minutes per run.

## Milestone 2 learnings (declarative primitives + focus)

- **`react-test-renderer` + RN preset: `findByType(Pressable)` doesn't
  find Pressables.** The Pressable identity exported from the test runtime
  copy of `react-native` doesn't match the one inside the host instance
  tree, so `findByType(Pressable)` returns 0. Workarounds that work:
    - `root.findAll((i) => typeof i.type !== 'string' && (i.type.displayName === 'Pressable' || i.type.name === 'Pressable'))`
    - Adding a `testID` and filtering by it — but be aware Pressable
      *forwards* `testID` to its host `View`, so `findAllByProps({ testID })`
      will return both the React component instance AND its host View. Filter
      by displayName as well, or filter by the presence of one of the
      props you actually set (`onPress`).
  Captured as a helper in `app/src/primitives/{Card,List}.test.tsx`.

- **Driving focus state in tests.** With the RN preset, `Pressable`'s
  `onFocus` / `onBlur` props are reachable from the Pressable React
  instance. The tests trigger them directly via
  `pressable.props.onFocus()` inside `ReactTestRenderer.act(...)` — no need
  to simulate native focus events.

- **Countdown determinism.** Use `jest.useFakeTimers()` +
  `jest.setSystemTime(new Date(...))` in `beforeEach`. The Countdown's
  `useEffect` registers a `setInterval(..., 1000)`; advance time with
  `jest.advanceTimersByTime(1000)` inside `act()` to assert the next
  rendered value.

- **JSON imports in App.tsx.** `@react-native/typescript-config` already sets
  `resolveJsonModule: true`, so `import sampleLayout from
  './src/fixtures/sample-layout.json'` Just Works. Cast at the import site
  rather than typing the JSON file with a `.d.ts`.

- **Smoke probe should look for *both* JS load AND your renderer.** M1's
  smoke probe only checked for `Running "app"`, which would still succeed
  if the bundle loaded but the renderer crashed and a red-box took over.
  M2 added a second marker, `M2: PrimitiveRenderer mounted`, that
  `App.tsx` logs via `useEffect` once the renderer has actually mounted.
  Both must appear before smoke reports success.

- **Focus indicator on `Pressable` is enough.** Driving a `borderColor` +
  small `transform: [{ scale: 1.02..1.04 }]` from `onFocus`/`onBlur` state
  on a regular `Pressable` produces a visible focus ring on tvOS without
  requiring `tvParallaxProperties` or `reanimated`. Verified in the
  milestone-2 screenshot: the focused Card has a `#7aa2ff` border.

- **Initial focus.** With no `hasTVPreferredFocus={true}` set, the focus
  engine grabs the first focusable in tree order on mount — which is what
  the M2 layout wants (focus lands on the first Card). Don't add the prop
  unless you actually want to override that.

- **Why no FlatList in `List`.** `FlatList`/virtualised lists have known
  focus-engine rough edges on tvOS, and the M2 lists are tiny. Using a
  plain `View` of mapped `Pressable`s lets the focus engine "just work"
  with up/down navigation between rows. Revisit only if a primitive needs
  to handle hundreds of items.

## Milestone 3 learnings (component runtime, fetch, intervals)

- **Hermes `fetch()` Just Works against `raw.githubusercontent.com`.** No
  ATS exception needed — `https://raw.githubusercontent.com/...` returns
  `text/plain; charset=utf-8` and the JS thread parses it without any
  native config changes. M1's worry about ATS turned out to be a non-event
  for HTTPS endpoints on `*.githubusercontent.com`. CORS, as expected, is
  irrelevant on native RN.

- **External fixture lives in a sibling repo, not this one.** The M3
  Calendar fetches from
  `https://raw.githubusercontent.com/jpshackelford/nohands-extensions/main/fixtures/sample.ics`.
  Self-hosting the fixture inside this PoC repo would have created a
  chicken-and-egg between the PR (where `main` doesn't have the file yet)
  and CI smoke (which fetches at runtime). Hosting it externally makes
  PR-phase and post-merge CI fetch behave identically. The sibling repo
  is `jpshackelford/nohands-extensions`.

- **`raw.githubusercontent.com` caches for 300s (`max-age=300`).** Any
  fixture edit during dev won't show up in the running sim immediately;
  expect ~5 minutes (or use a query-string cache buster) before a fresh
  smoke captures the change. Verified during M3 when the screenshot
  initially showed stale data after I bumped the DTSTART.

- **Fixture dates must stay in the future.** Calendar's `render()` filters
  out past events so the next-meeting Card stays accurate. The committed
  `sample.ics` uses `DTSTART:20300615T...` so the Card has something to
  point at for years. Tests don't read from the fixture file — they use
  inline `SAMPLE_ICS` strings + `jest.setSystemTime(...)` for
  determinism, so the live fixture's dates can drift independently.

- **`ComponentHost` uses `useRef` + `useReducer` force-render, not
  `useState`.** `ctx.setState` and `ctx.render` can be invoked from
  inside an interval callback that was registered while `setup()` was
  still pending. With `useState`, the post-resolve `setState` could race
  with the interval-driven `setState`. A single `stateRef.current` (read
  synchronously, mutated in place) plus an explicit `forceRender` makes
  those orderings deterministic and unblocks the unit tests.

- **Test the post-`await` chain by flushing several microtasks.** When
  `Calendar`'s refresh interval body chains `fetchAndParse(url).then(...)`,
  the body returns `undefined` and the test can't `await` it. Two
  `await Promise.resolve()` rounds aren't always enough — the chain is
  `fetch → res.text → parseICalSimple (sync) → setState`. The
  `Calendar.test.ts` refresh test flushes 6 rounds to be robust.

- **`jest.spyOn(console, 'log').mockImplementation(...)`** silences the
  M3 marker (and warnings) in the test suite so it doesn't pollute Jest
  output. Don't forget to `mockRestore()` in `afterEach` or the next
  describe block runs without `console.log` and stops seeing failures.

- **iCal unfolding strips the fold whitespace.** RFC 5545 says a CRLF
  followed by a single whitespace char marks a continuation; unfolding
  removes that whitespace. So `"long\r\n word"` parses to `"longword"`,
  NOT `"long word"`. If you want a literal space, the source must emit
  two leading spaces (one fold + one content space).

- **Smoke probe pattern keeps evolving.** M1 grepped `Running "app"`.
  M2 added `M2: PrimitiveRenderer mounted`. M3 added TWO markers and
  the smoke probe now requires all three:
    1. `Running "app"` — JS bundle started executing.
    2. `M3: <id> setup resolved` — `setup()` promise resolved.
    3. `M3: <id> layout=["..."]` — at least one primitive on screen.
  The third marker closes a real gap: a unit test pyramid + a
  setup-resolved marker would still pass if `render(state)` returned
  `[]` from the host. The host now logs the rendered layout shape on
  every shape change AFTER state is resolved AND the array is
  non-empty, and the smoke probe regex `M3: .* layout=\["[a-z]+`
  rejects an empty array. Stops the silent-blank-screen failure mode
  reaching CI green.

- **eslint-config doesn't enable `no-console`.** Don't add
  `// eslint-disable-next-line no-console` comments — they trip the
  `eslint-comments/no-unused-disable` rule. Just `console.log` directly.

### Tooling installed during 2026-06-06 setup session

| Tool | Source | Notes |
|---|---|---|
| `xcbeautify` 3.2.1 | brew | Renders xcodebuild output readable |
| `watchman` 2026.06.01 | brew | Metro file watcher |
| `swiftlint` 0.63.3 | brew | Needs Xcode.app present |
| `cocoapods` 1.16.2_2 | brew | Brings its own Ruby 4.0; bypasses old system Ruby |
| Xcode | App Store | 26.3 / build 17C529 |
| tvOS 26.2 sim | `xcodebuild -downloadPlatform tvOS` | ~3 GB |
| `openjdk` 26.0.1 | brew | Required by Maestro CLI (JVM-based) |
| `maestro` 2.6.0 | brew tap `mobile-dev-inc/tap` | See M4 finding below — does not yet support tvOS |

## Milestone 4 learnings (runtime bundle loader, Hermes eval verdict, Maestro tvOS gap)

### The headline finding: **runtime `new Function()` eval works on tvOS Hermes in BOTH Debug and Release**

The M4 PoC question — "can we hot-load a JS component bundle from a URL at runtime?" — has an empirical answer:

- **Debug build (Metro + Hermes interpreter)**: `new Function(...sandboxNames, fetchedCode)` evaluates the bundle, calls run, and `exports.component` becomes a real, callable `Component<State>`. Verified by `./scripts/smoke.sh` against the live bundle at `raw.githubusercontent.com/jpshackelford/nohands-extensions/main/bundles/calendar.bundle.js`. All four log markers fire (`Running "app"`, `M4: bundle loaded …`, `M3: <id> setup resolved`, `M3: <id> layout=…`). Identical visual output to the M3 in-tree Calendar.

- **Release build (Hermes precompiled bytecode bundle, NO Metro)**: Same `new Function(...)` path, same outcome. Verified by `xcodebuild -configuration Release`, install, launch with Metro killed, watch log — all four markers fire and the visible app is identical. Screenshot at `docs/screenshots/milestone-4-release.png` (and the canonical `milestone-4.png` is the same Release capture).

Implication: **the "shared component runtime hot-loaded from URLs" vision is feasible on Apple TV.** No need to fall back to Hermes bytecode bundles or JSON-only components. (The fallback paths are still listed in the M4 issue as documented escape hatches if a future Hermes / RN version disables eval; they are not needed today.)

### Sandbox shape (allow + deny, scope-only)

`app/src/runtime/sandbox.ts` exposes a fixed allow list via `new Function`'s parameter list:

- `exports`, `fetch`, `setTimeout/setInterval/clearTimeout/clearInterval`, `Date`, `Math`, `JSON`, `URL`, `console.{log,warn,error}`.

It ALSO binds a deny list to `undefined` in the same parameter list — this shadows host globals of the same name inside the bundle scope. Deny list: `process`, `require`, `module`, `XMLHttpRequest`, `WebSocket`, `document`, `window`, `localStorage`, `sessionStorage`, `AsyncStorage`, `NativeModules`, `global`, `globalThis`.

**Known sandbox escape, documented in `sandbox.ts`**: a malicious bundle can still reach the host realm via `(0, eval)('this')` or by reading any non-deny-listed host global the author happens to know the name of. The unit test `arbitrary unmentioned globalThis properties remain visible` deliberately locks this in as a documented limitation. The sandbox is **shape-only**, not capability-only — production use needs a separate JS realm (which Hermes doesn't expose) or a vetted-publisher model.

### Loader contract (every failure mode is a distinct error message)

`app/src/runtime/loader.ts` returns a `Component<unknown>` or throws an `Error` whose message starts with `loader:`. Distinct prefixes for each:

- `loader: HTTP <status> fetching <url>` — non-2xx response.
- `loader: network error fetching <url> — <message>` — fetch threw.
- `loader: bundle body too small (<n> bytes) from <url>` — body < 64 bytes (the smaller the bundle, the more likely it's a wrong-URL response).
- `loader: bundle source did not parse — <SyntaxError message>` — `new Function` constructor threw.
- `loader: bundle threw during evaluation — <message>` — bundle body threw at top level.
- `loader: bundle did not assign exports.component` — eval ok, no component assigned.
- `loader: bundle exports.component is not an object (got <typeof>)`.
- `loader: bundle component missing required "id" | "setup" | "render"`.
- `loader: bundle component "config" must be an object if provided`.

`RemoteComponent.tsx` catches these, renders a `text` primitive `Error: <message>` (so smoke + Maestro can see it) AND `console.error`s a `RemoteComponent: <message>` line. Both signals are visible to the smoke probe and to the running sim's screen.

### Component-id-prefixed M3 markers — no host change needed

`ComponentHost` already logs `M3: ${component.id} setup resolved` and `M3: ${component.id} layout=[...]`. The remote calendar bundle uses `id: 'calendar-remote'` so its markers are distinguishable from the in-tree `calendar` id in the log. The smoke probe's regex `M3: .* setup resolved` and `M3: .* layout=\["[a-z]+` are component-id-agnostic — same probe works for in-tree and remote components without script changes.

### `M4:` marker for the loader itself

`RemoteComponent` emits `M4: bundle loaded id=<id> url=<url>` once the loader resolves. Not currently required by `scripts/smoke.sh` (the existing 3 markers + the M3 setup-resolved being triggered by a remote-mounted host is already sufficient signal), but it's useful evidence in CI logs and a hook for future smoke checks if the probe needs to distinguish in-tree vs remote.

### Open question: keep `app/src/components/Calendar.ts` post-M4 or delete?

The M4 PR description leaves this open for the maintainer. After verification, the in-tree Calendar is functionally redundant with the remote one. Deleting reduces the surface area; keeping leaves a known-good fallback if `nohands-extensions` ever 404s. Decision tracked in PR #9.

## Maestro tvOS gap (M4) — the dependency the milestone discovered the world doesn't have yet

The M4 brief mandated `tvos-maestro` as a blocking CI job with at least two flows (bundle-loaded + focus-navigation). The flows are checked in at `app/.maestro/`. **They cannot run on tvOS today** because:

1. **Maestro CLI 2.6.0** (Jun 2026, currently `brew install mobile-dev-inc/tap/maestro`) ships exactly two driver variants inside `maestro-ios-driver.jar`:
   ```
   driver-iphoneos/Debug-iphoneos/maestro-driver-iosUITests-Runner.zip
   driver-iPhoneSimulator/Debug-iphonesimulator/maestro-driver-iosUITests-Runner.zip
   ```
   No `appletvsimulator` or `appletvos` build exists. (`unzip -l /opt/homebrew/Cellar/maestro/2.6.0/libexec/lib/maestro-ios-driver.jar | grep zip`.)

2. The XCUITest runner app's Info.plist declares `UIDeviceFamily = [1, 2]` (iPhone, iPad). tvOS sims report device family `3`. `simctl install` refuses with:
   > `App installation failed: This app was not built to support this device family; app is compatible with (1, 2) but this device supports (3).`

3. **Maestro's CLI `list-devices` happily enumerates tvOS sims** (it lists everything `simctl` lists), which is misleading — the driver pipeline downstream cannot actually install on them.

### What we did instead

- Kept `app/.maestro/bundle-loaded.yaml` and `app/.maestro/focus-navigation.yaml` checked in, authored against the correct primitives, **ready to run the day upstream Maestro adds a tvOS-targeted XCUITest runner**. The flows assert (a) "Next Meeting" / "Standup" / "Starts in" visible after the remote bundle loads, and (b) the app stays responsive + the layout intact across Right-arrow Siri Remote presses.
- Added a `tvos-maestro` CI job that installs Java + Maestro, runs `maestro list-devices`, and attempts `maestro test app/.maestro/`. The flow attempt is `continue-on-error: true` because it WILL fail until upstream lands tvOS support. The day it starts succeeding, we flip `continue-on-error` off and `tvos-maestro` becomes a true blocking gate.
- The blocking E2E gate for M4 remains the **3-marker smoke probe inside `tvos-smoke`**. It already catches the failure modes the brief was worried about: JS didn't load, setup() crashed, render() returned `[]` (the silent-blank-screen case). What it does NOT catch is a focus-engine regression that doesn't change the rendered text — and a tvOS-aware E2E tool is exactly the thing that doesn't exist off the shelf in Jun 2026.

### Alternatives investigated and rejected

| Path | Why rejected |
|---|---|
| Fork Maestro and add tvOS XCUITest runner targets | 1–2 day project; out of scope for an M4 close. Tracked as a future issue. |
| AppleScript-driven key send (`osascript -e 'tell System Events to key code 124'`) + screenshot diff | Requires the Simulator window in front and Accessibility permission; non-headless. Tested locally — the keypress did not reliably reach the sim app (Card focus ring did not move after Right press). Not viable for CI. |
| `idb ui key` (Facebook iOS device bridge) | Same iPhone/iPad device-family constraint as Maestro; no tvOS path. |
| Detox | Explicitly out of scope per the M4 brief (heavier instrumentation, 10× setup time). |
| Custom XCUITest test target running directly inside the app | Real path forward, but a 2–4 day project that constitutes Milestone 5+ work, not an M4 follow-on fix. |

### Operating Maestro as an agent (local dev recipe)

```sh
# Install (one time)
brew install openjdk
brew install mobile-dev-inc/tap/maestro

# Per-session environment (Maestro's brew formula doesn't expose JAVA_HOME)
export JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_DRIVER_STARTUP_TIMEOUT=180000

# These work today on tvOS:
maestro --version              # prints 2.6.0 (after a wall of JDK warnings)
maestro list-devices           # lists tvOS sims among others

# This FAILS today on tvOS with "device family 3 not supported":
maestro --udid <tvOS-udid> test app/.maestro/bundle-loaded.yaml

# Failure logs land at ~/.maestro/tests/<timestamp>/xctest_runner_*.log
# Grep for "App installation failed" to confirm the family-3 block.
```

## Milestone 4 finalised tooling additions

| Tool | Source | Notes |
|---|---|---|
| `maestro` 2.6.0 | brew tap `mobile-dev-inc/tap` | tvOS install path blocked upstream; flows checked in for the day it lands |
| `openjdk` 26.0.1 | brew | Required by Maestro |
