import React from 'react';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import { List } from './List';

function collectText(node: ReactTestInstance | string | null): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  return (node.children ?? []).map(collectText).join(' ');
}

/**
 * Find list-row Pressable instances. The Pressable component forwards its
 * `testID` to its host View, so a `findAllByProps({ testID })` would match
 * both. We instead filter on the function-component identity (displayName
 * 'Pressable'), which uniquely identifies the row root.
 */
function findRows(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    (inst) =>
      inst.props.testID === 'list-row' &&
      typeof inst.type !== 'string' &&
      ((inst.type as React.ComponentType).displayName === 'Pressable' ||
        (inst.type as { name?: string }).name === 'Pressable'),
  );
}

async function render(ui: React.ReactElement) {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(ui);
  });
  return tree!;
}

describe('List primitive', () => {
  const items = [
    { title: '9:00 AM - Standup' },
    { title: '11:00 AM - Design Review', subtitle: 'Conference Rm 3' },
    { title: '2:00 PM - 1:1 with Manager' },
  ];

  test('renders each item title and any provided subtitles', async () => {
    const tree = await render(<List items={items} />);
    const text = collectText(tree.root);
    expect(text).toContain('9:00 AM - Standup');
    expect(text).toContain('11:00 AM - Design Review');
    expect(text).toContain('Conference Rm 3');
    expect(text).toContain('2:00 PM - 1:1 with Manager');
  });

  test('renders one focusable row per item with onFocus/onBlur handlers', async () => {
    const tree = await render(<List items={items} />);
    const rows = findRows(tree.root);
    expect(rows).toHaveLength(items.length);
    for (const row of rows) {
      expect(typeof row.props.onFocus).toBe('function');
      expect(typeof row.props.onBlur).toBe('function');
    }
  });

  test('forwards onItemPress with item and index', async () => {
    const onItemPress = jest.fn();
    const tree = await render(
      <List items={items} onItemPress={onItemPress} />,
    );
    const rows = findRows(tree.root);
    await ReactTestRenderer.act(() => {
      rows[1].props.onPress();
    });
    expect(onItemPress).toHaveBeenCalledWith(items[1], 1);
  });

  test('handles empty items without throwing', async () => {
    const tree = await render(<List items={[]} />);
    expect(findRows(tree.root)).toHaveLength(0);
  });
});
