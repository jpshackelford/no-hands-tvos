/**
 * sandbox.ts — explicit allow-list of globals exposed to a remotely-loaded
 * component bundle (Milestone 4).
 *
 * Why "shape-only" sandboxing?
 *
 *   Hermes does not expose a `vm`-like isolated context the way Node does.
 *   Every JS value in the running app lives in the same realm. We cannot
 *   stop a sufficiently motivated bundle from escaping via, e.g.,
 *   `(0, eval)('this')` or mutating shared prototypes — *if* eval is
 *   available at runtime. The sandbox here is a **scope** boundary, not a
 *   capability boundary: the bundle's outer scope only sees what we hand
 *   it via `new Function(...keys, code)`'s parameter list, plus whatever
 *   identifiers can be reached via `globalThis` indirection. We mitigate
 *   the latter by *also* binding the well-known "forbidden" names as
 *   parameters set to `undefined`, which shadows them inside the bundle
 *   scope (so a bare `process.env` access throws TypeError instead of
 *   silently working). A production setup would need a separate JS
 *   runtime or a vetted-publisher model — that's out of scope for this
 *   PoC.
 *
 * Allow list (kept short — add only when a new bundle genuinely needs it):
 *
 *   exports         — receptacle for `exports.component = {...}`.
 *   fetch           — HTTPS network access. CORS does not apply on RN.
 *   setTimeout / setInterval / clearTimeout / clearInterval — timers.
 *                     The host's `ComponentContext` also exposes managed
 *                     versions that auto-clear on unmount; raw timer
 *                     access is provided so a bundle can synthesize its
 *                     own once-off scheduling if needed.
 *   Date            — needed by virtually any time-aware component.
 *   Math, JSON      — pure ECMAScript built-ins, no side effects.
 *   URL             — for safe URL parsing/assembly.
 *   console         — a forwarding stub that only exposes `.log`, `.warn`,
 *                     `.error`. Other console methods are unavailable
 *                     (we don't want bundles spelunking `console.dir` or
 *                     accidentally calling `console.profile`).
 *
 * Deny list (bound to `undefined` so a bare identifier reference in the
 * bundle scope resolves to `undefined`, not the real host global):
 *
 *   process, require, module                       — Node-isms.
 *   XMLHttpRequest, WebSocket                      — alternate net stacks.
 *   document, window, localStorage, sessionStorage — DOM/web storage.
 *   AsyncStorage, NativeModules                    — RN-specific surface.
 *   global, globalThis                             — explicit escape hatch.
 *
 * NB: a bundle author can still construct strings, arrays, objects — those
 * are implicit ECMAScript built-ins reachable via literals and not
 * something we can or should withhold. The sandbox restricts *named host
 * bindings*, not the language itself.
 */

/** Receptacle the bundle writes its component into. */
export type BundleExports = {
  component?: unknown;
};

/** Object handed to `new Function` as both the param-name list and arg-value list. */
export type SandboxAllowList = {
  exports: BundleExports;
  fetch: typeof fetch;
  setTimeout: typeof setTimeout;
  setInterval: typeof setInterval;
  clearTimeout: typeof clearTimeout;
  clearInterval: typeof clearInterval;
  Date: typeof Date;
  Math: typeof Math;
  JSON: typeof JSON;
  URL: typeof URL;
  console: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
  };
};

/**
 * Build a fresh allow-list bindings object. Each call returns its own
 * `exports` so the host can run multiple bundles in parallel without
 * cross-talk.
 *
 * `fetch` et al. are read from `globalThis` at the time the sandbox is
 * built, so a test that swaps `globalThis.fetch` before calling
 * `createSandbox()` will see its replacement.
 */
export function createSandbox(): SandboxAllowList {
  return {
    exports: {},
    fetch: globalThis.fetch,
    setTimeout: globalThis.setTimeout,
    setInterval: globalThis.setInterval,
    clearTimeout: globalThis.clearTimeout,
    clearInterval: globalThis.clearInterval,
    Date,
    Math,
    JSON,
    URL,
    console: {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    },
  };
}

/** Sorted list of allow-list names — useful for tests and for callers iterating predictably. */
export const SANDBOX_ALLOW_NAMES: ReadonlyArray<keyof SandboxAllowList> = [
  'exports',
  'fetch',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'Date',
  'Math',
  'JSON',
  'URL',
  'console',
];

/**
 * Names the host explicitly shadows with `undefined` in the bundle scope
 * so the bundle can't silently fall through to the host global. Verified
 * by `sandbox.test.ts`.
 */
export const SANDBOX_DENY_NAMES: ReadonlyArray<string> = [
  'process',
  'require',
  'module',
  'XMLHttpRequest',
  'WebSocket',
  'document',
  'window',
  'localStorage',
  'sessionStorage',
  'AsyncStorage',
  'NativeModules',
  'global',
  'globalThis',
];

/**
 * Returns the full parameter-name list to hand to `new Function`: the
 * allow-list names followed by the deny-list names. Stable order, so the
 * matching value list in `buildSandboxArgs` lines up positionally.
 */
export function buildSandboxParamNames(): string[] {
  return [...SANDBOX_ALLOW_NAMES, ...SANDBOX_DENY_NAMES];
}

/**
 * Returns the value list in the same order as `buildSandboxParamNames`.
 * Allow-list values come from the provided sandbox; deny-list values are
 * all `undefined` (shadowing the host global of the same name inside the
 * bundle scope).
 */
export function buildSandboxArgs(sandbox: SandboxAllowList): unknown[] {
  const allowVals = SANDBOX_ALLOW_NAMES.map(
    (k) => sandbox[k as keyof SandboxAllowList],
  );
  const denyVals = SANDBOX_DENY_NAMES.map(() => undefined);
  return [...allowVals, ...denyVals];
}
