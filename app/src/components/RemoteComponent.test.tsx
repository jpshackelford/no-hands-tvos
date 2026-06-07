/**
 * RemoteComponent.test.tsx — covers the three visible states (loading,
 * error, ready→ComponentHost) and asserts the M4 marker fires.
 *
 * The tests use real React + react-test-renderer (no shallow rendering),
 * and the loader runs end-to-end (real `new Function` eval of an
 * inline bundle source string). Only `globalThis.fetch` is stubbed.
 */

import React from 'react';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';

import { RemoteComponent } from './RemoteComponent';

function collectText(node: ReactTestInstance | string | null): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  return (node.children ?? []).map(collectText).join(' ');
}

async function flushPromises() {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
}

const PAD = '\n// '.padEnd(80, '*');

const HELLO_BUNDLE = `
(function (exports) {
  exports.component = {
    id: 'hello-remote-test',
    config: {},
    async setup() { return { greeting: 'Hello from remote' }; },
    render(state) {
      return [{ type: 'card', title: state.greeting, focusable: true }];
    },
  };
})(typeof exports !== 'undefined' ? exports : (this.B = {}));
${PAD}
`;

const URL = 'https://example.test/bundle.js';

function okResp(body: string): Response {
  return {
    ok: true,
    status: 200,
    text: async () => body,
  } as unknown as Response;
}
function badResp(status: number): Response {
  return {
    ok: false,
    status,
    text: async () => '',
  } as unknown as Response;
}

describe('RemoteComponent', () => {
  let logSpy: jest.SpyInstance;
  let errSpy: jest.SpyInstance;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    if (fetchSpy) fetchSpy.mockRestore();
  });

  test('shows a Loading placeholder before fetch resolves', () => {
    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        () => new Promise<Response>(() => {}) as unknown as ReturnType<typeof fetch>,
      );
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <RemoteComponent bundleUrl={URL} config={{}} />,
      );
    });
    expect(collectText(tree!.root)).toContain(`Loading bundle from ${URL}`);
  });

  test('on successful load: renders the bundle component via ComponentHost', async () => {
    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(okResp(HELLO_BUNDLE) as never);

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <RemoteComponent bundleUrl={URL} config={{}} />,
      );
      await flushPromises();
    });
    const text = collectText(tree!.root);
    expect(text).toContain('Hello from remote');

    // M4 marker for "bundle loaded" + M3 host marker.
    expect(logSpy).toHaveBeenCalledWith(
      `M4: bundle loaded id=hello-remote-test url=${URL}`,
    );
    expect(logSpy).toHaveBeenCalledWith(
      'M3: hello-remote-test setup resolved',
    );
    expect(logSpy).toHaveBeenCalledWith(
      'M3: hello-remote-test layout=["card"]',
    );
  });

  test('on loader error: renders an error primitive and logs to console.error', async () => {
    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(badResp(404) as never);

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <RemoteComponent bundleUrl={URL} config={{}} />,
      );
      await flushPromises();
    });
    const text = collectText(tree!.root);
    expect(text).toContain('Error: loader: HTTP 404 fetching');
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^RemoteComponent: loader: HTTP 404 /),
    );
  });
});
