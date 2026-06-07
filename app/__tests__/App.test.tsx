/**
 * @format
 *
 * App.test.tsx — Milestone 4
 *
 * `App` now mounts a `RemoteComponent` that loads the M4 calendar
 * bundle from raw.githubusercontent.com and renders it via the M3
 * ComponentHost. To exercise the *real* loader + sandbox + host stack
 * without hitting the network, this test stubs `globalThis.fetch` to:
 *
 *   1. return the calendar bundle JS source when the bundle URL is hit;
 *   2. return a small fixed iCal feed when the bundle's own
 *      `setup()` calls `fetch(config.icalUrl)`.
 *
 * Everything else — the `new Function` eval, the sandbox shadowing, the
 * ComponentHost lifecycle — runs end-to-end.
 */

import React from 'react';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import App from '../App';
import {
  CALENDAR_BUNDLE_URL,
  HELLO_BUNDLE_URL,
} from '../src/components/remote-config';
import { CALENDAR_ICAL_URL } from '../src/components/calendar-config';

function collectText(node: ReactTestInstance | string | null): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  return (node.children ?? []).map(collectText).join(' ');
}

// Inline bundle source — a shape-compatible reimplementation of the
// live `bundles/calendar.bundle.js` over in nohands-extensions. We
// deliberately do NOT read the on-disk sibling bundle from this test:
// it would tie the JS test suite to a directory layout assumption
// that doesn't hold in CI (the sibling repo isn't cloned there). The
// network-level test of the real bundle happens in `scripts/smoke.sh`
// and in the Maestro flows under `app/.maestro/`.
const CALENDAR_BUNDLE_SOURCE = `
  (function (exports) {
    exports.component = {
      id: 'calendar-remote',
      config: { icalUrl: { type: 'string', required: true } },
      async setup(config, ctx) {
        var res = await fetch(config.icalUrl);
        var body = await res.text();
        var lines = body.split(/\\r?\\n/);
        var events = [];
        var cur = null;
        for (var i = 0; i < lines.length; i++) {
          var l = lines[i];
          if (l === 'BEGIN:VEVENT') cur = {};
          else if (l === 'END:VEVENT') {
            if (cur && cur.title && cur.start) events.push(cur);
            cur = null;
          } else if (cur) {
            if (l.indexOf('SUMMARY:') === 0) cur.title = l.slice(8);
            else if (l.indexOf('DTSTART:') === 0) {
              var v = l.slice(8);
              var m = v.match(/^(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})Z$/);
              if (m) cur.start = new Date(m[1]+'-'+m[2]+'-'+m[3]+'T'+m[4]+':'+m[5]+':'+m[6]+'Z');
            }
          }
        }
        events.sort(function (a, b) { return a.start.getTime() - b.start.getTime(); });
        console.log('M3: calendar-remote setup resolved (' + events.length + ' events)');
        ctx.setInterval(function () { ctx.render(); }, 30000);
        return { events: events };
      },
      render(state) {
        var now = Date.now();
        var upcoming = state.events.filter(function (e) { return e.start.getTime() >= now; });
        var next = upcoming[0];
        var layout = [];
        if (next) {
          var h24 = next.start.getUTCHours();
          var mm = next.start.getUTCMinutes();
          var period = h24 >= 12 ? 'PM' : 'AM';
          var h12 = h24 % 12 === 0 ? 12 : h24 % 12;
          var time = h12 + ':' + String(mm).padStart(2, '0') + ' ' + period;
          layout.push({ type: 'card', title: 'Next Meeting', subtitle: next.title, content: time, focusable: true });
          layout.push({ type: 'countdown', target: next.start.toISOString(), label: 'Starts in' });
        } else {
          layout.push({ type: 'card', title: 'No upcoming meetings', focusable: true });
        }
        layout.push({ type: 'list', items: upcoming.slice(0,5).map(function (e) {
          var h24 = e.start.getUTCHours();
          var mm = e.start.getUTCMinutes();
          var period = h24 >= 12 ? 'PM' : 'AM';
          var h12 = h24 % 12 === 0 ? 12 : h24 % 12;
          var time = h12 + ':' + String(mm).padStart(2, '0') + ' ' + period;
          return { title: time + ' — ' + e.title };
        })});
        return layout;
      },
    };
  })(typeof exports !== 'undefined' ? exports : (this.B = {}));
`;

const SAMPLE_ICS = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'SUMMARY:Standup',
  'DTSTART:20260527T090000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'SUMMARY:Design Review',
  'DTSTART:20260527T110000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'SUMMARY:1:1 with Manager',
  'DTSTART:20260527T140000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

function makeFetchStub(bundleSource: string): typeof fetch {
  return jest.fn(async (input: unknown) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : '';
    if (url === CALENDAR_BUNDLE_URL) {
      return {
        ok: true,
        status: 200,
        text: async () => bundleSource,
      } as unknown as Response;
    }
    if (url === HELLO_BUNDLE_URL) {
      return {
        ok: true,
        status: 200,
        text: async () =>
          `(function(e){e.component={id:'h',config:{},setup:async()=>({}),render:()=>[{type:'text',text:'h'}]};})(typeof exports!=='undefined'?exports:{});`,
      } as unknown as Response;
    }
    if (url === CALENDAR_ICAL_URL) {
      return {
        ok: true,
        status: 200,
        text: async () => SAMPLE_ICS,
      } as unknown as Response;
    }
    return {
      ok: false,
      status: 404,
      text: async () => `unexpected url ${url}`,
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

async function flushPromises() {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
}

async function render() {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
    await flushPromises();
  });
  return tree!;
}

describe('App (Milestone 4: RemoteComponent + remote calendar bundle)', () => {
  let logSpy: jest.SpyInstance;
  let errSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-27T08:00:00Z'));
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (globalThis as { fetch: typeof fetch }).fetch =
      makeFetchStub(CALENDAR_BUNDLE_SOURCE);
  });

  afterEach(() => {
    jest.useRealTimers();
    logSpy.mockRestore();
    errSpy.mockRestore();
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  test('renders without throwing', async () => {
    const tree = await render();
    expect(tree).toBeDefined();
  });

  test('renders the remote Calendar layout once setup() resolves', async () => {
    const tree = await render();
    const text = collectText(tree.root);

    expect(text).toContain('Next Meeting');
    expect(text).toContain('Standup');
    expect(text).toContain('Starts in');
    expect(text).toContain('01:00:00');
    expect(text).toContain('9:00 AM');
    expect(text).toContain('Design Review');
    expect(text).toContain('1:1 with Manager');
  });

  test('logs the M4 and M3 smoke markers after setup resolves', async () => {
    await render();
    expect(logSpy).toHaveBeenCalledWith(
      `M4: bundle loaded id=calendar-remote url=${CALENDAR_BUNDLE_URL}`,
    );
    expect(logSpy).toHaveBeenCalledWith(
      'M3: calendar-remote setup resolved (3 events)',
    );
    expect(logSpy).toHaveBeenCalledWith('M3: calendar-remote setup resolved');
    expect(logSpy).toHaveBeenCalledWith(
      'M3: calendar-remote layout=["card","countdown","list"]',
    );
  });
});
