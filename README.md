# no-hands-tvos

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

## Related

- [voice-relay](https://github.com/jpshackelford/voice-relay) - Main project
- Design doc: Voice-Relay Kiosk Display Brainstorm (conversation 2fc2a97a)
