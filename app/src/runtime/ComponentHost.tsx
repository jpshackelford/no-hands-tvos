import { useEffect, useReducer, useRef } from 'react';

import { PrimitiveRenderer } from '../renderer/PrimitiveRenderer';
import type {
  LayoutDefinition,
  PrimitiveDefinition,
} from '../renderer/types';

import type {
  Component,
  ComponentContext,
  Config,
} from './types';

export type ComponentHostProps<State> = {
  component: Component<State>;
  config: Config;
};

/**
 * Host that turns a pure-data `Component<State>` into a live React tree:
 *
 *   1. On mount: calls `component.setup(config, ctx)` exactly once.
 *   2. While `setup()` is pending: renders a "Loading" placeholder.
 *   3. If `setup()` rejects: renders the error message so it's visible on
 *      the simulator screen (not just lost in the log).
 *   4. Once `setup()` resolves: stores the returned state and renders
 *      `component.render(state)` through the M2 `PrimitiveRenderer`.
 *
 * The `ComponentContext` handed to `setup()` provides:
 *   - `setInterval(fn, ms)` / `setTimeout(fn, ms)` — IDs tracked
 *     internally and cleared on unmount, so the component doesn't have to
 *     own them.
 *   - `setState(partial)` — merges into state and triggers a re-render.
 *   - `render()` — forces a re-render without changing state (e.g. so a
 *     `countdown` primitive can tick once per second based on `Date.now()`
 *     without the parent having to mutate state).
 *
 * After `setup()` resolves the host logs `M3: <component.id> setup resolved`
 * which the M3 smoke probe greps for. Individual components are free to log
 * their own richer marker (Calendar adds the event count).
 */
export function ComponentHost<State>({
  component,
  config,
}: ComponentHostProps<State>) {
  // We use a ref for state because the host's behaviour needs synchronous
  // reads from inside `ctx.setState`/`ctx.render` callbacks that may be
  // invoked from timers registered before React has scheduled a re-render.
  // `forceRender` bumps a counter to trigger a render after we mutate
  // `stateRef.current`.
  const stateRef = useRef<State | null>(null);
  const errorRef = useRef<Error | null>(null);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  // Tracks intervals & timeouts so we can clear them on unmount.
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);
  // Guards against re-running setup if React decides to re-invoke effects
  // (e.g. StrictMode double-effect). Tests don't use StrictMode but it's
  // cheap insurance against future regressions.
  const setupStartedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    if (setupStartedRef.current) {
      return;
    }
    setupStartedRef.current = true;

    const ctx: ComponentContext<State> = {
      setInterval: (fn, ms) => {
        const id = setInterval(() => {
          if (!mountedRef.current) return;
          fn();
        }, ms);
        intervalsRef.current.push(id);
      },
      setTimeout: (fn, ms) => {
        const id = setTimeout(() => {
          if (!mountedRef.current) return;
          fn();
        }, ms);
        timeoutsRef.current.push(id);
      },
      setState: (partial) => {
        if (!mountedRef.current) return;
        const prev = stateRef.current;
        if (prev == null) {
          // Before initial setup() resolves there is no state to merge into.
          // Surface this via console.warn rather than silently losing the
          // update — it usually means a timer registered inside setup() is
          // firing before setup() itself resolved (e.g. tests that don't
          // await the promise).
          console.warn(
            `ComponentHost(${component.id}): setState called before setup() resolved; partial dropped`,
          );
          return;
        }
        stateRef.current = { ...prev, ...partial };
        forceRender();
      },
      render: () => {
        if (!mountedRef.current) return;
        forceRender();
      },
    };

    component
      .setup(config, ctx)
      .then((initial) => {
        if (!mountedRef.current) return;
        stateRef.current = initial;
        console.log(`M3: ${component.id} setup resolved`);
        forceRender();
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        errorRef.current =
          err instanceof Error ? err : new Error(String(err));
        console.error(
          `ComponentHost(${component.id}): setup rejected — ${errorRef.current.message}`,
        );
        forceRender();
      });

    return () => {
      mountedRef.current = false;
      for (const id of intervalsRef.current) clearInterval(id);
      for (const id of timeoutsRef.current) clearTimeout(id);
      intervalsRef.current = [];
      timeoutsRef.current = [];
    };
    // We intentionally run setup once per host instance. If the consumer
    // changes `component` or `config` they should remount via `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const primitives: PrimitiveDefinition[] = (() => {
    if (errorRef.current) {
      return [
        {
          type: 'text',
          text: `Error: ${errorRef.current.message}`,
        },
      ];
    }
    if (stateRef.current == null) {
      return [{ type: 'text', text: `Loading ${component.id}…` }];
    }
    return component.render(stateRef.current);
  })();

  // Log the rendered layout shape once per state-resolved render that
  // actually changed shape AND has at least one primitive. This catches
  // "ComponentHost mounted but render() returned []" failures at smoke
  // time — the marker simply never fires for an empty layout, and the
  // smoke probe (which requires `M3: <id> layout=["..."]` with at least
  // one quoted type) exits non-zero instead of silently passing on a
  // blank-screen render.
  const layoutShape = primitives.map((p) => p.type).join(',');
  const lastLayoutShapeRef = useRef<string | null>(null);
  useEffect(() => {
    if (stateRef.current == null || errorRef.current) return;
    if (primitives.length === 0) return;
    if (lastLayoutShapeRef.current === layoutShape) return;
    lastLayoutShapeRef.current = layoutShape;
    const json = `[${primitives.map((p) => `"${p.type}"`).join(',')}]`;
    console.log(`M3: ${component.id} layout=${json}`);
  });

  const layout: LayoutDefinition = { layout: primitives };
  return <PrimitiveRenderer definition={layout} />;
}
