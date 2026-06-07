/**
 * loader.ts — fetches a remote component bundle and evaluates it in the
 * sandbox built by `sandbox.ts` (Milestone 4).
 *
 * The contract: `loadComponent(url)` returns a `Component<unknown>` ready
 * to hand to `ComponentHost`, or rejects with an `Error` whose message
 * starts with `loader:` so the caller (and the smoke / Maestro probes)
 * can distinguish a load failure from a setup/render failure further
 * downstream.
 *
 * Why `new Function` instead of `eval`?
 *
 *   `eval` would evaluate the source in the *caller's* scope, leaking
 *   our local variables (`response`, `code`, `sandbox`, ...) into the
 *   bundle. `new Function` creates a fresh function whose only scope
 *   chain is its parameter list + global scope. Combined with the
 *   deny-list shadow in `buildSandboxArgs`, that's the tightest scope
 *   we can give the bundle without dropping to a separate JS realm
 *   (which Hermes doesn't expose).
 *
 * Failure modes (each surfaces as a distinct `loader:` error message so
 * the loader.test.ts assertions and any future debugging is precise):
 *
 *   - HTTP non-2xx                  → `loader: HTTP <status> fetching <url>`
 *   - Body too small to be a bundle → `loader: bundle body too small (<n> bytes)`
 *   - new Function syntax error     → `loader: bundle source did not parse — <syntax err>`
 *   - new Function runtime throw    → `loader: bundle threw during evaluation — <message>`
 *   - exports.component missing     → `loader: bundle did not assign exports.component`
 *   - exports.component.id missing  → `loader: bundle component missing required "id"`
 *   - exports.component shape bad   → `loader: bundle component missing required "<setup|render>"`
 */

import type { Component } from './types';
import {
  buildSandboxArgs,
  buildSandboxParamNames,
  createSandbox,
} from './sandbox';

/**
 * Minimum plausible bundle size. The hello bundle is ~900 bytes; the
 * calendar bundle is ~6 KB. Anything below this is almost certainly a
 * fetch-mismatch (e.g. a 200 OK serving the wrong path, or an empty
 * placeholder) — fail loudly instead of trying to eval 2 bytes of HTML.
 */
const MIN_BUNDLE_BYTES = 64;

export async function loadComponent(
  url: string,
): Promise<Component<unknown>> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(
      `loader: network error fetching ${url} — ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  if (!response.ok) {
    throw new Error(`loader: HTTP ${response.status} fetching ${url}`);
  }
  const code = await response.text();
  if (code.length < MIN_BUNDLE_BYTES) {
    throw new Error(
      `loader: bundle body too small (${code.length} bytes) from ${url}`,
    );
  }

  const sandbox = createSandbox();
  let bundleFn: Function;
  try {
    // eslint-disable-next-line no-new-func
    bundleFn = new Function(...buildSandboxParamNames(), code);
  } catch (err) {
    throw new Error(
      `loader: bundle source did not parse — ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  try {
    bundleFn(...buildSandboxArgs(sandbox));
  } catch (err) {
    throw new Error(
      `loader: bundle threw during evaluation — ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const raw = sandbox.exports.component;
  if (raw == null) {
    throw new Error('loader: bundle did not assign exports.component');
  }
  if (typeof raw !== 'object') {
    throw new Error(
      `loader: bundle exports.component is not an object (got ${typeof raw})`,
    );
  }
  const component = raw as {
    id?: unknown;
    config?: unknown;
    setup?: unknown;
    render?: unknown;
  };
  if (typeof component.id !== 'string' || component.id.length === 0) {
    throw new Error('loader: bundle component missing required "id"');
  }
  if (typeof component.setup !== 'function') {
    throw new Error('loader: bundle component missing required "setup"');
  }
  if (typeof component.render !== 'function') {
    throw new Error('loader: bundle component missing required "render"');
  }
  // `config` is optional in the runtime contract (an empty schema is
  // fine), but if present it must be an object — otherwise the host's
  // config-reading helpers would NPE later.
  if (component.config != null && typeof component.config !== 'object') {
    throw new Error(
      'loader: bundle component "config" must be an object if provided',
    );
  }

  return raw as Component<unknown>;
}
