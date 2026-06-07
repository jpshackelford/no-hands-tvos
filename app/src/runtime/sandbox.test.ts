/**
 * sandbox.test.ts — asserts the M4 sandbox contract.
 *
 * Strategy:
 *   - Build the sandbox via `createSandbox()` and the full param/arg
 *     list via `buildSandboxParamNames()` / `buildSandboxArgs(...)`.
 *   - Construct a probe `new Function(...names, probeSrc)` and call it
 *     with the matching arg list. The probe writes into the `exports`
 *     we hand it; we then inspect what it saw.
 *   - Both allow-list visibility AND deny-list shadowing are exercised
 *     against the *real* bundle scope, not via direct property
 *     inspection of the sandbox object.
 */

import {
  createSandbox,
  buildSandboxParamNames,
  buildSandboxArgs,
  SANDBOX_ALLOW_NAMES,
  SANDBOX_DENY_NAMES,
} from './sandbox';

function runProbe(probeSrc: string): Record<string, unknown> {
  const sandbox = createSandbox();
  // eslint-disable-next-line no-new-func
  const fn = new Function(...buildSandboxParamNames(), probeSrc);
  fn(...buildSandboxArgs(sandbox));
  return sandbox.exports as Record<string, unknown>;
}

describe('createSandbox', () => {
  test('exposes exactly the documented allow-list names', () => {
    const sandbox = createSandbox();
    expect(Object.keys(sandbox).sort()).toEqual(
      [...SANDBOX_ALLOW_NAMES].sort(),
    );
  });

  test('exports is a fresh object per call (no cross-bundle leakage)', () => {
    const a = createSandbox();
    const b = createSandbox();
    a.exports.component = { id: 'a' };
    expect(b.exports.component).toBeUndefined();
  });

  test('console forwards only log/warn/error', () => {
    const sandbox = createSandbox();
    expect(typeof sandbox.console.log).toBe('function');
    expect(typeof sandbox.console.warn).toBe('function');
    expect(typeof sandbox.console.error).toBe('function');
    expect(Object.keys(sandbox.console).sort()).toEqual(
      ['error', 'log', 'warn'],
    );
  });

  test('Date, Math, JSON, URL are the real globals', () => {
    const sandbox = createSandbox();
    expect(sandbox.Date).toBe(Date);
    expect(sandbox.Math).toBe(Math);
    expect(sandbox.JSON).toBe(JSON);
    expect(sandbox.URL).toBe(URL);
  });

  test('fetch is captured at sandbox-creation time from globalThis', () => {
    const original = globalThis.fetch;
    const stub = jest.fn() as unknown as typeof fetch;
    (globalThis as { fetch?: typeof fetch }).fetch = stub;
    try {
      const sandbox = createSandbox();
      expect(sandbox.fetch).toBe(stub);
    } finally {
      (globalThis as { fetch?: typeof fetch }).fetch = original;
    }
  });
});

describe('sandbox bindings as seen inside a bundle scope', () => {
  test('allowed bindings ARE visible inside the bundle scope', () => {
    const exportsObj = runProbe(`
      exports.haveFetch = typeof fetch === 'function';
      exports.haveSetInterval = typeof setInterval === 'function';
      exports.haveSetTimeout = typeof setTimeout === 'function';
      exports.haveClearInterval = typeof clearInterval === 'function';
      exports.haveClearTimeout = typeof clearTimeout === 'function';
      exports.haveDate = typeof Date === 'function';
      exports.haveMath = typeof Math === 'object';
      exports.haveJSON = typeof JSON === 'object';
      exports.haveURL = typeof URL === 'function';
      exports.haveConsoleLog = typeof console.log === 'function';
    `);
    expect(exportsObj).toEqual({
      haveFetch: true,
      haveSetInterval: true,
      haveSetTimeout: true,
      haveClearInterval: true,
      haveClearTimeout: true,
      haveDate: true,
      haveMath: true,
      haveJSON: true,
      haveURL: true,
      haveConsoleLog: true,
    });
  });

  test.each(SANDBOX_DENY_NAMES)(
    'deny-list global %s is shadowed to undefined in the bundle scope',
    (name) => {
      // Bare identifier inside `new Function` body resolves via the
      // function's param list first. We bind every deny name as a
      // parameter with `undefined` value — so `typeof name` should be
      // 'undefined' even if globalThis[name] is the real host global.
      const exportsObj = runProbe(`
        exports.seenType = typeof ${name};
        exports.seenValue = ${name};
      `);
      expect(exportsObj.seenType).toBe('undefined');
      expect(exportsObj.seenValue).toBeUndefined();
    },
  );

  test('deny shadowing actually overrides a real host global', () => {
    // Sanity: `globalThis.process` exists in the Node test runtime, but
    // the bundle scope sees `undefined`. This proves the param-shadow is
    // doing work, not just luck.
    expect(typeof (globalThis as { process?: unknown }).process).toBe('object');
    const exportsObj = runProbe(`
      exports.processType = typeof process;
    `);
    expect(exportsObj.processType).toBe('undefined');
  });

  test('arbitrary unmentioned globalThis properties remain visible (documented limitation)', () => {
    // The sandbox is shape-only: we shadow the well-known dangerous
    // names but cannot rebuild the entire global environment. A bundle
    // that knows the name of a non-shadowed host global can still read
    // it. This test makes that limitation explicit and locks it in —
    // if a future change starts blocking everything (e.g. via a Proxy
    // realm) this test should be updated, not silently passing.
    const sentinel = '__no_hands_tvos_m4_sandbox_probe__';
    (globalThis as Record<string, unknown>)[sentinel] = 42;
    try {
      const exportsObj = runProbe(`
        exports.seenType = typeof ${sentinel};
        exports.seenValue = ${sentinel};
      `);
      expect(exportsObj.seenType).toBe('number');
      expect(exportsObj.seenValue).toBe(42);
    } finally {
      delete (globalThis as Record<string, unknown>)[sentinel];
    }
  });
});
