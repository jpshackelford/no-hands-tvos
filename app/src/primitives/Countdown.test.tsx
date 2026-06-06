import React from 'react';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import { Countdown, formatDiff } from './Countdown';

function collectText(node: ReactTestInstance | string | null): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  return (node.children ?? []).map(collectText).join(' ');
}

async function render(ui: React.ReactElement) {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(ui);
  });
  return tree!;
}

describe('formatDiff (pure helper)', () => {
  test('renders multi-day targets as Dd HHh MMm SSs', () => {
    const ms =
      2 * 86400_000 + 3 * 3600_000 + 4 * 60_000 + 5_000; // 2d 03h 04m 05s
    expect(formatDiff(ms)).toBe('2d 03h 04m 05s');
  });

  test('renders sub-day targets as HH:MM:SS', () => {
    const ms = 1 * 3600_000 + 2 * 60_000 + 3_000;
    expect(formatDiff(ms)).toBe('01:02:03');
  });

  test('renders 0 / negative as "Starts now" within 5s', () => {
    expect(formatDiff(0)).toBe('Starts now');
    expect(formatDiff(-2_000)).toBe('Starts now');
  });

  test('reports elapsed seconds after 5s past target', () => {
    expect(formatDiff(-10_000)).toBe('Started 10s ago');
  });
});

describe('Countdown primitive', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-27T08:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders label and a formatted countdown', async () => {
    const tree = await render(
      <Countdown
        target="2026-05-27T09:00:00Z"
        label="Starts in"
      />,
    );
    const text = collectText(tree.root);
    expect(text).toContain('Starts in');
    expect(text).toContain('01:00:00');
  });

  test('ticks once per second', async () => {
    const tree = await render(
      <Countdown target="2026-05-27T09:00:00Z" label="Starts in" />,
    );
    expect(collectText(tree.root)).toContain('01:00:00');

    await ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(collectText(tree.root)).toContain('00:59:59');
  });

  test('falls back to "invalid target" for unparseable inputs', async () => {
    const tree = await render(<Countdown target="not-a-date" />);
    expect(collectText(tree.root)).toContain('invalid target');
  });
});
