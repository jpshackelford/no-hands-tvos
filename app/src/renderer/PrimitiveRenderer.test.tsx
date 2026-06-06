import React from 'react';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import { PrimitiveRenderer } from './PrimitiveRenderer';
import type { LayoutDefinition, PrimitiveDefinition } from './types';

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

describe('PrimitiveRenderer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-27T08:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders a card definition', async () => {
    const def: PrimitiveDefinition = {
      type: 'card',
      title: 'Card Title',
      subtitle: 'Card Subtitle',
    };
    const tree = await render(<PrimitiveRenderer definition={def} />);
    const text = collectText(tree.root);
    expect(text).toContain('Card Title');
    expect(text).toContain('Card Subtitle');
  });

  test('renders a list definition', async () => {
    const def: PrimitiveDefinition = {
      type: 'list',
      items: [{ title: 'item-a' }, { title: 'item-b' }],
    };
    const tree = await render(<PrimitiveRenderer definition={def} />);
    const text = collectText(tree.root);
    expect(text).toContain('item-a');
    expect(text).toContain('item-b');
  });

  test('renders a countdown definition', async () => {
    const def: PrimitiveDefinition = {
      type: 'countdown',
      target: '2026-05-27T09:00:00Z',
      label: 'Starts in',
    };
    const tree = await render(<PrimitiveRenderer definition={def} />);
    const text = collectText(tree.root);
    expect(text).toContain('Starts in');
    expect(text).toContain('01:00:00');
  });

  test('renders a text definition', async () => {
    const def: PrimitiveDefinition = { type: 'text', text: 'hi there' };
    const tree = await render(<PrimitiveRenderer definition={def} />);
    expect(collectText(tree.root)).toContain('hi there');
  });

  test('renders an unknown-type fallback rather than crashing', async () => {
    // Forced cast — the renderer must defend against bad data coming from
    // a JSON definition that the type system never saw.
    const def = { type: 'mystery', foo: 1 } as unknown as PrimitiveDefinition;
    const tree = await render(<PrimitiveRenderer definition={def} />);
    expect(collectText(tree.root)).toMatch(/Unknown:\s+mystery/);
  });

  test('renders a top-level layout of primitives', async () => {
    const layout: LayoutDefinition = {
      layout: [
        { type: 'card', title: 'A' },
        { type: 'text', text: 'B' },
        { type: 'list', items: [{ title: 'C' }] },
      ],
    };
    const tree = await render(<PrimitiveRenderer definition={layout} />);
    const text = collectText(tree.root);
    expect(text).toContain('A');
    expect(text).toContain('B');
    expect(text).toContain('C');
  });
});
