/**
 * @format
 */

import React from 'react';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import App from '../App';

/**
 * Walk the rendered tree and collect every string child. Same helper used by
 * the primitive unit tests.
 */
function collectText(node: ReactTestInstance | string | null): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  return (node.children ?? []).map(collectText).join(' ');
}

async function render() {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });
  return tree!;
}

describe('App (Milestone 2: declarative primitives)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Pin "now" so the Countdown output is deterministic across machines.
    jest.setSystemTime(new Date('2026-05-27T08:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders without throwing', async () => {
    const tree = await render();
    expect(tree).toBeDefined();
  });

  test('renders the sample layout primitives', async () => {
    const tree = await render();
    const text = collectText(tree.root);

    // Card
    expect(text).toContain('Next Meeting');
    expect(text).toContain('Standup');
    // Countdown
    expect(text).toContain('Starts in');
    expect(text).toContain('01:00:00');
    // List
    expect(text).toContain('9:00 AM - Standup');
    expect(text).toContain('11:00 AM - Design Review');
    expect(text).toContain('2:00 PM - 1:1 with Manager');
  });
});
