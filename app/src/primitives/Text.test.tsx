import React from 'react';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import { Text } from './Text';

function collectText(node: ReactTestInstance | string | null): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  return (node.children ?? []).map(collectText).join(' ');
}

describe('Text primitive', () => {
  test('renders its children verbatim', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<Text>Hello primitives</Text>);
    });
    expect(collectText(tree!.root)).toContain('Hello primitives');
  });

  test('applies a default style and lets callers override colour', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <Text style={{ color: '#ff0000' }}>red</Text>,
      );
    });
    const rendered = tree!.root.findByType(require('react-native').Text);
    const flat = Array.isArray(rendered.props.style)
      ? Object.assign({}, ...rendered.props.style)
      : rendered.props.style;
    expect(flat.fontSize).toBe(28);
    expect(flat.color).toBe('#ff0000');
  });
});
