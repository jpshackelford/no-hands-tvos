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
