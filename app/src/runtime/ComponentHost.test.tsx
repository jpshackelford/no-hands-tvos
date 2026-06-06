import React from 'react';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';

import { ComponentHost } from './ComponentHost';
import type { Component } from './types';

function collectText(node: ReactTestInstance | string | null): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  return (node.children ?? []).map(collectText).join(' ');
}

async function flushPromises() {
  // Drain microtasks queued behind any `await`s inside setup().
  await Promise.resolve();
  await Promise.resolve();
}

type DemoState = { greeting: string; tickCount: number };

const baseComponent: Component<DemoState> = {
  id: 'demo',
  config: {},
  async setup() {
    return { greeting: 'hello', tickCount: 0 };
  },
  render(state) {
    return [
      { type: 'text', text: state.greeting },
      { type: 'text', text: `ticks=${state.tickCount}` },
    ];
  },
};

describe('ComponentHost', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-27T08:00:00Z'));
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('renders loading placeholder before setup() resolves', async () => {
    let resolve!: (s: DemoState) => void;
    const pending = new Promise<DemoState>((r) => {
      resolve = r;
    });
    const component: Component<DemoState> = {
      ...baseComponent,
      setup: () => pending,
    };

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <ComponentHost component={component} config={{}} />,
      );
    });
    expect(collectText(tree.root)).toContain('Loading demo');

    // Resolve and confirm the rendered output flips.
    await ReactTestRenderer.act(async () => {
      resolve({ greeting: 'hi', tickCount: 0 });
      await flushPromises();
    });
    expect(collectText(tree.root)).toContain('hi');
  });

  test('runs setup() exactly once on mount and logs M3 marker', async () => {
    const setupSpy = jest.fn(baseComponent.setup);
    const component: Component<DemoState> = {
      ...baseComponent,
      setup: setupSpy,
    };

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <ComponentHost component={component} config={{}} />,
      );
      await flushPromises();
    });

    expect(setupSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('M3: demo setup resolved');
    expect(collectText(tree.root)).toContain('hello');
  });

  test('ctx.setState merges and re-renders with new primitives', async () => {
    let savedCtx: Parameters<Component<DemoState>['setup']>[1] | undefined;
    const component: Component<DemoState> = {
      ...baseComponent,
      async setup(_config, ctx) {
        savedCtx = ctx;
        return { greeting: 'hello', tickCount: 0 };
      },
    };

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <ComponentHost component={component} config={{}} />,
      );
      await flushPromises();
    });
    expect(collectText(tree.root)).toContain('hello');

    await ReactTestRenderer.act(async () => {
      savedCtx!.setState({ greeting: 'updated' });
    });
    const text = collectText(tree.root);
    expect(text).toContain('updated');
    // ticks must NOT be reset — setState merges, not replaces.
    expect(text).toContain('ticks=0');
  });

  test('ctx.setInterval callback fires after advanceTimersByTime', async () => {
    let savedCtx: Parameters<Component<DemoState>['setup']>[1] | undefined;
    const component: Component<DemoState> = {
      ...baseComponent,
      async setup(_config, ctx) {
        savedCtx = ctx;
        const initial: DemoState = { greeting: 'hello', tickCount: 0 };
        ctx.setInterval(() => {
          // Use a fresh closure read of "tickCount" via a counter trick:
          // we read from a shared object so the interval can keep
          // incrementing across firings.
          counter.value += 1;
          ctx.setState({ tickCount: counter.value });
        }, 1000);
        return initial;
      },
    };
    const counter = { value: 0 };

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <ComponentHost component={component} config={{}} />,
      );
      await flushPromises();
    });
    expect(savedCtx).toBeDefined();
    expect(collectText(tree.root)).toContain('ticks=0');

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(collectText(tree.root)).toContain('ticks=3');
  });

  test('ctx.render forces a re-render without changing state', async () => {
    // Demonstrate force-render by having render() read Date.now() so the
    // output changes purely because time moved.
    const dynamicComponent: Component<{ marker: string }> = {
      id: 'dynamic',
      config: {},
      async setup() {
        return { marker: 'static' };
      },
      render() {
        return [{ type: 'text', text: `now=${Date.now()}` }];
      },
    };

    let savedCtx:
      | Parameters<Component<{ marker: string }>['setup']>[1]
      | undefined;
    const component: Component<{ marker: string }> = {
      ...dynamicComponent,
      async setup(_config, ctx) {
        savedCtx = ctx;
        return { marker: 'static' };
      },
    };

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <ComponentHost component={component} config={{}} />,
      );
      await flushPromises();
    });
    const before = collectText(tree.root);
    expect(before).toContain(`now=${new Date('2026-05-27T08:00:00Z').getTime()}`);

    // Advance time WITHOUT firing any interval, then force a render.
    await ReactTestRenderer.act(async () => {
      jest.setSystemTime(new Date('2026-05-27T08:00:05Z'));
      savedCtx!.render();
    });
    const after = collectText(tree.root);
    expect(after).toContain(`now=${new Date('2026-05-27T08:00:05Z').getTime()}`);
    expect(after).not.toEqual(before);
  });

  test('intervals and timeouts are cleared on unmount', async () => {
    const intervalFn = jest.fn();
    const timeoutFn = jest.fn();
    const component: Component<DemoState> = {
      ...baseComponent,
      async setup(_config, ctx) {
        ctx.setInterval(intervalFn, 1000);
        ctx.setTimeout(timeoutFn, 5000);
        return { greeting: 'hello', tickCount: 0 };
      },
    };

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <ComponentHost component={component} config={{}} />,
      );
      await flushPromises();
    });

    await ReactTestRenderer.act(() => {
      tree.unmount();
    });

    // After unmount, both should NOT fire when their time arrives.
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(intervalFn).not.toHaveBeenCalled();
    expect(timeoutFn).not.toHaveBeenCalled();
  });

  test('renders the error message when setup() rejects', async () => {
    const component: Component<DemoState> = {
      ...baseComponent,
      async setup() {
        throw new Error('boom');
      },
    };

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <ComponentHost component={component} config={{}} />,
      );
      await flushPromises();
    });

    expect(collectText(tree.root)).toContain('Error: boom');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('setup rejected — boom'),
    );
    // M3 marker should NOT be logged when setup fails.
    expect(logSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('setup resolved'),
    );
  });
});
