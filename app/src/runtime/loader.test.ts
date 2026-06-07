/**
 * loader.test.ts — verifies the M4 component-bundle loader against real
 * eval'd source. No mocks for the eval path: the loader genuinely
 * constructs a `new Function`, runs it, and inspects the resulting
 * `exports.component`. Only `globalThis.fetch` is stubbed (we don't want
 * the unit suite hitting the network).
 *
 * Each failure mode in `loader.ts`'s documented contract has a dedicated
 * test below — the messages start with `loader:` and the tests assert
 * that prefix plus the distinguishing substring.
 */

import { loadComponent } from './loader';

type FetchInit = Parameters<typeof fetch>[1];

function mockFetch(
  impl: (url: string, init?: FetchInit) => Promise<Response>,
): jest.SpyInstance {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(impl as unknown as typeof fetch);
}

function okResponse(body: string): Response {
  return {
    ok: true,
    status: 200,
    text: async () => body,
  } as unknown as Response;
}

function notOkResponse(status: number): Response {
  return {
    ok: false,
    status,
    text: async () => '',
  } as unknown as Response;
}

const URL = 'https://example.test/bundle.js';
const PAD = '\n// '.padEnd(80, '*'); // bulk to clear MIN_BUNDLE_BYTES

const HELLO_BUNDLE = `
(function (exports) {
  exports.component = {
    id: 'hello-test',
    config: {},
    async setup() { return { greeting: 'Hi' }; },
    render(state) {
      return [{ type: 'card', title: state.greeting, focusable: true }];
    },
  };
})(typeof exports !== 'undefined' ? exports : (this.B = {}));
${PAD}
`;

describe('loadComponent', () => {
  let fetchSpy: jest.SpyInstance;

  afterEach(() => {
    if (fetchSpy) fetchSpy.mockRestore();
  });

  test('happy path: returns a Component with id/setup/render after eval', async () => {
    fetchSpy = mockFetch(async () => okResponse(HELLO_BUNDLE));
    const c = await loadComponent(URL);
    expect(c.id).toBe('hello-test');
    expect(typeof c.setup).toBe('function');
    expect(typeof c.render).toBe('function');

    // Verify setup+render actually run end-to-end on the loaded module.
    const state = await c.setup({}, {
      setInterval: () => {},
      setTimeout: () => {},
      setState: () => {},
      render: () => {},
    });
    const layout = c.render(state);
    expect(layout).toEqual([
      { type: 'card', title: 'Hi', focusable: true },
    ]);
  });

  test('HTTP 404 → loader: HTTP 404 …', async () => {
    fetchSpy = mockFetch(async () => notOkResponse(404));
    await expect(loadComponent(URL)).rejects.toThrow(
      /^loader: HTTP 404 fetching /,
    );
  });

  test('network error → loader: network error …', async () => {
    fetchSpy = mockFetch(async () => {
      throw new Error('boom');
    });
    await expect(loadComponent(URL)).rejects.toThrow(
      /^loader: network error fetching .* — boom/,
    );
  });

  test('body too small → loader: bundle body too small', async () => {
    fetchSpy = mockFetch(async () => okResponse('x = 1;'));
    await expect(loadComponent(URL)).rejects.toThrow(
      /^loader: bundle body too small \(6 bytes\)/,
    );
  });

  test('malformed JS → loader: bundle source did not parse', async () => {
    fetchSpy = mockFetch(async () =>
      okResponse(`this is not valid javascript at all !!! ${PAD}`),
    );
    await expect(loadComponent(URL)).rejects.toThrow(
      /^loader: bundle source did not parse/,
    );
  });

  test('runtime throw inside bundle → loader: bundle threw during evaluation', async () => {
    fetchSpy = mockFetch(async () =>
      okResponse(`throw new Error('explodey-bundle'); ${PAD}`),
    );
    await expect(loadComponent(URL)).rejects.toThrow(
      /^loader: bundle threw during evaluation — explodey-bundle/,
    );
  });

  test('missing exports.component → loader: bundle did not assign', async () => {
    fetchSpy = mockFetch(async () =>
      okResponse(`(function () { var x = 1; }()); ${PAD}`),
    );
    await expect(loadComponent(URL)).rejects.toThrow(
      /^loader: bundle did not assign exports.component$/,
    );
  });

  test('exports.component not an object → loader: not an object', async () => {
    fetchSpy = mockFetch(async () =>
      okResponse(`exports.component = 'a string'; ${PAD}`),
    );
    await expect(loadComponent(URL)).rejects.toThrow(
      /^loader: bundle exports.component is not an object/,
    );
  });

  test('missing id → loader: missing required "id"', async () => {
    fetchSpy = mockFetch(async () =>
      okResponse(
        `exports.component = { config: {}, setup: async () => ({}), render: () => [] }; ${PAD}`,
      ),
    );
    await expect(loadComponent(URL)).rejects.toThrow(
      /^loader: bundle component missing required "id"$/,
    );
  });

  test('missing setup → loader: missing required "setup"', async () => {
    fetchSpy = mockFetch(async () =>
      okResponse(
        `exports.component = { id: 'x', config: {}, render: () => [] }; ${PAD}`,
      ),
    );
    await expect(loadComponent(URL)).rejects.toThrow(
      /^loader: bundle component missing required "setup"$/,
    );
  });

  test('missing render → loader: missing required "render"', async () => {
    fetchSpy = mockFetch(async () =>
      okResponse(
        `exports.component = { id: 'x', config: {}, setup: async () => ({}) }; ${PAD}`,
      ),
    );
    await expect(loadComponent(URL)).rejects.toThrow(
      /^loader: bundle component missing required "render"$/,
    );
  });

  test('config of wrong type → loader: "config" must be an object', async () => {
    fetchSpy = mockFetch(async () =>
      okResponse(
        `exports.component = { id: 'x', config: 'wrong', setup: async () => ({}), render: () => [] }; ${PAD}`,
      ),
    );
    await expect(loadComponent(URL)).rejects.toThrow(
      /^loader: bundle component "config" must be an object if provided$/,
    );
  });

  test('sandbox deny-list shadows process inside the bundle (regression)', async () => {
    // Reach into globalThis.process in the bundle. With the deny-list
    // shadowing applied, this should resolve to `undefined` and the
    // bundle should record that — not crash with ReferenceError, and
    // not see the real Node `process` object.
    const probeBundle = `
      exports.component = {
        id: 'probe',
        config: {},
        async setup() { return { processType: typeof process }; },
        render(state) {
          return [{ type: 'text', text: 'process=' + state.processType }];
        },
      };
      ${PAD}
    `;
    fetchSpy = mockFetch(async () => okResponse(probeBundle));
    const c = await loadComponent(URL);
    const state = await c.setup({}, {
      setInterval: () => {},
      setTimeout: () => {},
      setState: () => {},
      render: () => {},
    });
    expect((state as { processType: string }).processType).toBe('undefined');
  });
});
