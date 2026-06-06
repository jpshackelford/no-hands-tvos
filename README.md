# no-hands-tvos

[![CI](https://github.com/jpshackelford/no-hands-tvos/actions/workflows/ci.yml/badge.svg)](https://github.com/jpshackelford/no-hands-tvos/actions/workflows/ci.yml)

Proof of concept for the No-Hands.dev universal component framework on tvOS.

## Purpose

Validate key architectural assumptions before building the full component system:

1. **React Native tvOS works** - Can we build and run an RN app on Apple TV?
2. **Dynamic JS execution** - Can components run JavaScript logic at runtime?
3. **External data fetching** - Can components fetch from URLs (iCal, APIs)?
4. **Declarative UI primitives** - Can we render cards, lists, countdowns from JSON?
5. **Hot-loading components** - Can we load component bundles from external URLs?
6. **Focus navigation** - Does Siri Remote / focus engine work?

## Architecture Hypothesis

```
┌─────────────────────────────────────────────────────────────────┐
│                     COMPONENT BUNDLE                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  LOGIC LAYER (JavaScript - runs everywhere via JSC/Hermes) ││
│  │                                                              ││
│  │  • fetch() - get iCal, weather API, etc.                    ││
│  │  • Parse, calculate, filter                                  ││
│  │  • Timers, intervals                                         ││
│  │  • State management                                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  VIEW LAYER (Declarative primitives - rendered per platform)││
│  │                                                              ││
│  │  { type: 'card', title: state.nextEvent.title }             ││
│  │  { type: 'countdown', target: state.nextEvent.startTime }   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Milestones

### Milestone 1: Hello tvOS
- [ ] React Native tvOS app builds and runs on simulator
- [ ] Shows "Hello from tvOS" on screen
- [ ] Validates: RN tvOS works

### Milestone 2: Render Primitives
- [ ] Hardcoded JSON → renders Card, List, Countdown
- [ ] Focus navigation works with Siri Remote
- [ ] Validates: Declarative UI model works

### Milestone 3: Execute JS Logic
- [ ] Hardcoded component with `setup()` and `render()`
- [ ] Fetches data from a URL, parses it, renders result
- [ ] Validates: JS logic layer works

### Milestone 4: Hot-Load Component
- [ ] Fetch component bundle from external URL
- [ ] Execute it in sandbox
- [ ] Render its output
- [ ] Validates: Hot-loading works on tvOS

## Expected Learnings

| If it works... | Then... |
|----------------|---------|
| RN tvOS builds | ✅ Proceed with confidence |
| Primitives render | ✅ Declarative model is viable |
| JS logic executes | ✅ Universal components work |
| Hot-loading works | ✅ Full ecosystem vision is possible |
| Focus engine works | ✅ tvOS is first-class, not degraded |

| If it fails... | Then... |
|----------------|---------|
| RN tvOS won't build | ⚠️ Community support may be dead |
| Dynamic JS blocked | ⚠️ Need static bundling, no hot-load |
| Focus is broken | ⚠️ tvOS needs custom work |

## Development

### Prerequisites (macOS)

- Xcode 26.3+ with the tvOS 26.2+ simulator runtime installed
- Node 22 + npm 10
- CocoaPods (`brew install cocoapods`)
- watchman (`brew install watchman`)

### Setup

```sh
git clone https://github.com/jpshackelford/no-hands-tvos.git
cd no-hands-tvos/app
npm install
( cd ios && pod install )
```

### Day-to-day commands

| Command | What it does |
|---|---|
| `npm --prefix app test` | Jest unit tests |
| `npm --prefix app run lint` | ESLint |
| `npm --prefix app run typecheck` | `tsc --noEmit` |
| `npm --prefix app start` | Start Metro bundler |
| `./scripts/smoke.sh` | End-to-end: native build + sim boot + install + launch + screenshot |
| `./scripts/snap-sim.sh --window out.png` | Capture the Simulator window (with chrome) for a PR or issue |

### Continuous Integration

[GitHub Actions](.github/workflows/ci.yml) runs on every push to `main` and every PR:

1. **`js` (ubuntu-latest, ~30s)** — lint + typecheck + Jest unit tests.
2. **`tvos-smoke` (macos-15, ~14 min cold / ~5 min warm)** — gated on `js`. Ensures the tvOS simulator runtime is installed, restores CocoaPods + DerivedData caches, runs `scripts/smoke.sh`, and uploads the resulting screenshot and `.build-logs/` as artifacts (14-day retention).

CI is the source of truth for "this milestone really works on a clean machine, not just my laptop." Per-run smoke screenshots can be downloaded from the run page or via `gh run download <run-id>`.

### For agents / sub-agents

[`AGENTS.md`](AGENTS.md) captures the hard-won project knowledge: working build recipes, the codegen-race retry pattern, focus-engine quirks, screenshot tooling, sudo posture, and dead-ends already explored. Read it before starting work on a new milestone.

## Related

- [voice-relay](https://github.com/jpshackelford/voice-relay) - Main project
- Design doc: Voice-Relay Kiosk Display Brainstorm (conversation 2fc2a97a)

## License

**This repository is source-visible, not open source.** All rights reserved.
The code is published here for demonstration and reference only. No license to
use, copy, modify, or distribute it is granted. See [LICENSE](LICENSE) for the
full notice and [jpshack@gmail.com](mailto:jpshack@gmail.com) for licensing
inquiries.
