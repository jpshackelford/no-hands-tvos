/**
 * @format
 */

import React from 'react';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import App from '../App';

/**
 * Walk the rendered tree and collect every string child.
 * react-test-renderer doesn't give us a built-in textContent helper, so we
 * recurse manually.
 */
function collectText(node: ReactTestInstance | string | null): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  const children = node.children ?? [];
  return children.map(collectText).join(' ');
}

describe('App (Milestone 1: Hello tvOS)', () => {
  test('renders without throwing', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<App />);
    });
    expect(tree).toBeDefined();
  });

  test('shows "Hello from tvOS"', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<App />);
    });
    const text = collectText(tree!.root);
    expect(text).toContain('Hello from tvOS');
  });

  test('shows a Milestone 1 indicator', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<App />);
    });
    const text = collectText(tree!.root);
    expect(text).toMatch(/Milestone 1/);
  });

  test('shows the Platform.OS value', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<App />);
    });
    const text = collectText(tree!.root);
    // In Jest under the react-native preset the platform is mocked as 'ios'.
    // On real tvOS Platform.isTVOS is true; both render the same line.
    expect(text).toMatch(/Platform\.OS\s*=\s*\w+/);
  });
});
