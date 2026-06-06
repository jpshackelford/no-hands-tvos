/**
 * @format
 */

import React from 'react';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import App from '../App';

function collectText(node: ReactTestInstance | string | null): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  return (node.children ?? []).map(collectText).join(' ');
}

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

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function render() {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
    await flushPromises();
  });
  return tree!;
}

describe('App (Milestone 3: ComponentHost + Calendar)', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-27T08:00:00Z'));
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    (globalThis as { fetch: typeof fetch }).fetch = jest.fn().mockResolvedValue(
      {
        ok: true,
        status: 200,
        text: async () => SAMPLE_ICS,
      } as unknown as Response,
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    logSpy.mockRestore();
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  test('renders without throwing', async () => {
    const tree = await render();
    expect(tree).toBeDefined();
  });

  test('renders the Calendar layout once setup() resolves', async () => {
    const tree = await render();
    const text = collectText(tree.root);

    // Card from Calendar.render: title is fixed, subtitle is the next event.
    expect(text).toContain('Next Meeting');
    expect(text).toContain('Standup');
    // Countdown to 09:00 UTC at "now" 08:00 UTC == 01:00:00 remaining.
    expect(text).toContain('Starts in');
    expect(text).toContain('01:00:00');
    // List of upcoming events, formatted by Calendar.formatTime.
    expect(text).toContain('9:00 AM');
    expect(text).toContain('Design Review');
    expect(text).toContain('1:1 with Manager');
  });

  test('logs the M3 smoke marker after setup resolves', async () => {
    await render();
    expect(logSpy).toHaveBeenCalledWith(
      'M3: calendar setup resolved (3 events)',
    );
    expect(logSpy).toHaveBeenCalledWith('M3: calendar setup resolved');
  });
});
