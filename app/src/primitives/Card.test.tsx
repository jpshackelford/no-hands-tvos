import React from 'react';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import { Card } from './Card';

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

/**
 * Find the root Card instance — the Pressable (focusable) or View (static)
 * the Card renders. We filter on `testID === 'card'` AND that the props
 * actually carry our component-level handlers (or none, for the static case),
 * because Pressable forwards `testID` to its host View, which would otherwise
 * duplicate matches.
 */
function findCard(root: ReactTestInstance): ReactTestInstance {
  const matches = root.findAll((inst) => {
    if (inst.props.testID !== 'card') return false;
    // Focusable case: the React component instance named 'Pressable'.
    if (typeof inst.type !== 'string') {
      const t = inst.type as { displayName?: string; name?: string };
      return t.displayName === 'Pressable' || t.name === 'Pressable';
    }
    // Static (focusable=false) case: a single host 'View' with our testID.
    // Pressable would forward testID to a host 'View' too, but in the
    // static case there's no Pressable ancestor — accept only when there's
    // no onFocus handler propagated.
    return (
      (inst.type as string) === 'View' &&
      typeof inst.props.onFocus !== 'function'
    );
  });
  if (matches.length === 0) {
    throw new Error('Could not find Card root instance with testID="card"');
  }
  return matches[0];
}

const FOCUSED_BORDER = '#7aa2ff';

function styleIncludes(
  inst: ReactTestInstance,
  predicate: (s: any) => boolean,
): boolean {
  const s = inst.props.style;
  const arr = Array.isArray(s) ? s : [s];
  return arr.some((entry) => entry && predicate(entry));
}

describe('Card primitive', () => {
  test('renders title, subtitle, and content text', async () => {
    const tree = await render(
      <Card title="Next Meeting" subtitle="Standup" content="With the team" />,
    );
    const text = collectText(tree.root);
    expect(text).toContain('Next Meeting');
    expect(text).toContain('Standup');
    expect(text).toContain('With the team');
  });

  test('omits subtitle and content when not provided', async () => {
    const tree = await render(<Card title="Just a title" />);
    const text = collectText(tree.root);
    expect(text).toContain('Just a title');
    expect(text).not.toContain('undefined');
  });

  test('is focusable by default (Card exposes onFocus/onBlur handlers)', async () => {
    const tree = await render(<Card title="Focusable" />);
    const card = findCard(tree.root);
    expect(typeof card.props.onFocus).toBe('function');
    expect(typeof card.props.onBlur).toBe('function');
    expect(card.props.accessibilityRole).toBe('button');
  });

  test('renders a static (non-focusable) container when focusable={false}', async () => {
    const tree = await render(<Card title="Static" focusable={false} />);
    const card = findCard(tree.root);
    expect(card.props.onFocus).toBeUndefined();
    expect(card.props.onPress).toBeUndefined();
  });

  test('invokes onPress when the Card is pressed', async () => {
    const onPress = jest.fn();
    const tree = await render(<Card title="Press me" onPress={onPress} />);
    const card = findCard(tree.root);
    await ReactTestRenderer.act(() => {
      card.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('applies a focused style after onFocus and clears it after onBlur', async () => {
    const tree = await render(<Card title="Focus state" />);
    const card = findCard(tree.root);

    expect(styleIncludes(card, (s) => s.borderColor === FOCUSED_BORDER)).toBe(
      false,
    );

    await ReactTestRenderer.act(() => {
      card.props.onFocus();
    });
    expect(styleIncludes(card, (s) => s.borderColor === FOCUSED_BORDER)).toBe(
      true,
    );

    await ReactTestRenderer.act(() => {
      card.props.onBlur();
    });
    expect(styleIncludes(card, (s) => s.borderColor === FOCUSED_BORDER)).toBe(
      false,
    );
  });
});
