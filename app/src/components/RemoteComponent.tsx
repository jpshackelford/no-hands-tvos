/**
 * RemoteComponent — fetches a component bundle at `bundleUrl`, evaluates
 * it via the M4 sandboxed loader, and mounts the resolved component
 * inside `ComponentHost` (Milestone 4).
 *
 * Three visible states:
 *   1. While the fetch+eval is in flight → a `text` primitive
 *      "Loading bundle from <url>…".
 *   2. On any loader error → a `text` primitive whose message starts
 *      with `Error:` and includes the loader's `loader:` prefix. The
 *      same message is `console.error`-logged for the smoke probe to
 *      see. This is the visible-error contract from the M4 acceptance
 *      criteria.
 *   3. On success → `<ComponentHost component={loaded} config={config} />`.
 *      The host's own `M3:` markers then fire as if the component had
 *      always been in-tree.
 *
 * Why not just do the loading inside `App.tsx`? Three reasons:
 *   - keeps `App.tsx` as a thin shell that only knows the URL+config
 *     pair, which makes the M4-vs-M3 swap a one-line change;
 *   - lets us unit-test the load+mount path without a SafeAreaProvider;
 *   - gives a natural place to render an error primitive on the screen
 *     (so smoke/Maestro see the failure, instead of a silent blank).
 */

import { useEffect, useState } from 'react';

import { ComponentHost } from '../runtime/ComponentHost';
import { loadComponent } from '../runtime/loader';
import type { Component, Config } from '../runtime/types';
import { PrimitiveRenderer } from '../renderer/PrimitiveRenderer';

export type RemoteComponentProps = {
  bundleUrl: string;
  config: Config;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; component: Component<unknown> }
  | { kind: 'error'; message: string };

export function RemoteComponent({ bundleUrl, config }: RemoteComponentProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadComponent(bundleUrl)
      .then((component) => {
        if (cancelled) return;
        console.log(
          `M4: bundle loaded id=${component.id} url=${bundleUrl}`,
        );
        setState({ kind: 'ready', component });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : String(err);
        // Same shape as ComponentHost's setup-error path, so the smoke
        // probe + Maestro can read either one.
        console.error(`RemoteComponent: ${message}`);
        setState({ kind: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [bundleUrl]);

  if (state.kind === 'loading') {
    return (
      <PrimitiveRenderer
        definition={{
          layout: [{ type: 'text', text: `Loading bundle from ${bundleUrl}…` }],
        }}
      />
    );
  }
  if (state.kind === 'error') {
    return (
      <PrimitiveRenderer
        definition={{
          layout: [{ type: 'text', text: `Error: ${state.message}` }],
        }}
      />
    );
  }
  return <ComponentHost component={state.component} config={config} />;
}
