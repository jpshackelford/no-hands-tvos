/**
 * Runtime types for the no-hands-tvos component model (Milestone 3).
 *
 * A `Component<State>` is a pure-data definition that knows how to:
 *   - declare what configuration it expects (`config: ConfigSchema`)
 *   - bootstrap itself once on mount via `setup(config, ctx)` (e.g. fetch
 *     data, register intervals)
 *   - render its current `state` into declarative primitives the M2
 *     `PrimitiveRenderer` knows how to draw
 *
 * The component never touches React directly. The `ComponentHost` does that
 * on its behalf and exposes a `ComponentContext` to `setup()` for state
 * management, scheduled work, and forced re-renders (e.g. for the
 * Countdown ticking once a second without changing `events`).
 */

import type { PrimitiveDefinition } from '../renderer/types';

export interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean';
    required?: boolean;
    default?: unknown;
    secret?: boolean;
  };
}

export type Config = Record<string, unknown>;

export interface ComponentContext<State> {
  /** Schedules a recurring callback; cleared automatically on unmount. */
  setInterval: (fn: () => void, ms: number) => void;
  /** Schedules a one-shot callback; cleared automatically on unmount. */
  setTimeout: (fn: () => void, ms: number) => void;
  /** Merge a partial into state and re-render. */
  setState: (partial: Partial<State>) => void;
  /** Force a re-render without changing state (e.g. for countdown ticks). */
  render: () => void;
}

export interface Component<State> {
  id: string;
  config: ConfigSchema;
  /** Runs once on mount. Return the initial state. */
  setup: (config: Config, ctx: ComponentContext<State>) => Promise<State>;
  /** View layer — pure function of state. Returns declarative primitives. */
  render: (state: State) => PrimitiveDefinition[];
}
