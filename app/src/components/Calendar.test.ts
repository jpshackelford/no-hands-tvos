import { calendarComponent, formatTime, type CalendarState } from './Calendar';
import type { ComponentContext } from '../runtime/types';

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

type FakeCtx<S> = ComponentContext<S> & {
  intervals: { fn: () => void; ms: number }[];
  timeouts: { fn: () => void; ms: number }[];
  state: Partial<S>;
  renders: number;
};

function makeCtx<S>(): FakeCtx<S> {
  const intervals: { fn: () => void; ms: number }[] = [];
  const timeouts: { fn: () => void; ms: number }[] = [];
  const state: Partial<S> = {};
  const ctx = {
    intervals,
    timeouts,
    state,
    renders: 0,
    setInterval(fn: () => void, ms: number) {
      intervals.push({ fn, ms });
    },
    setTimeout(fn: () => void, ms: number) {
      timeouts.push({ fn, ms });
    },
    setState(partial: Partial<S>) {
      Object.assign(state, partial);
    },
    render() {
      ctx.renders += 1;
    },
  };
  return ctx;
}

function stubFetch(payload: string, ok = true, status = 200) {
  const fn = jest.fn().mockResolvedValue({
    ok,
    status,
    text: async () => payload,
  } as unknown as Response);
  (globalThis as { fetch: typeof fetch }).fetch =
    fn as unknown as typeof fetch;
  return fn;
}

describe('formatTime', () => {
  test('formats AM/PM based on UTC', () => {
    expect(formatTime(new Date('2026-05-27T09:00:00Z'))).toBe('9:00 AM');
    expect(formatTime(new Date('2026-05-27T11:00:00Z'))).toBe('11:00 AM');
    expect(formatTime(new Date('2026-05-27T14:00:00Z'))).toBe('2:00 PM');
    expect(formatTime(new Date('2026-05-27T00:00:00Z'))).toBe('12:00 AM');
    expect(formatTime(new Date('2026-05-27T12:00:00Z'))).toBe('12:00 PM');
  });
});

describe('calendarComponent.setup', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-27T08:00:00Z'));
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    logSpy.mockRestore();
    warnSpy.mockRestore();
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  test('fetches the URL and parses events', async () => {
    const fetchSpy = stubFetch(SAMPLE_ICS);
    const ctx = makeCtx<CalendarState>();

    const state = await calendarComponent.setup(
      { icalUrl: 'https://example.test/sample.ics' },
      ctx,
    );

    expect(fetchSpy).toHaveBeenCalledWith('https://example.test/sample.ics');
    expect(state.events.map((e) => e.title)).toEqual([
      'Standup',
      'Design Review',
      '1:1 with Manager',
    ]);
    expect(state.fetchedAt).toBe(
      new Date('2026-05-27T08:00:00Z').getTime(),
    );
  });

  test('logs the M3 marker with the event count', async () => {
    stubFetch(SAMPLE_ICS);
    const ctx = makeCtx<CalendarState>();
    await calendarComponent.setup(
      { icalUrl: 'https://example.test/sample.ics' },
      ctx,
    );
    expect(logSpy).toHaveBeenCalledWith(
      'M3: calendar setup resolved (3 events)',
    );
  });

  test('registers refresh and tick intervals via ctx', async () => {
    stubFetch(SAMPLE_ICS);
    const ctx = makeCtx<CalendarState>();
    await calendarComponent.setup(
      { icalUrl: 'https://example.test/sample.ics' },
      ctx,
    );
    const periods = ctx.intervals.map((i) => i.ms).sort((a, b) => a - b);
    expect(periods).toEqual([30 * 1000, 15 * 60 * 1000]);
  });

  test('refresh interval re-fetches and applies fresh events via ctx.setState', async () => {
    const fetchSpy = stubFetch(SAMPLE_ICS);
    const ctx = makeCtx<CalendarState>();
    await calendarComponent.setup(
      { icalUrl: 'https://example.test/sample.ics' },
      ctx,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Swap the fetch payload so the next call returns a different feed.
    const REFRESHED = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Reschedule',
      'DTSTART:20260527T100000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    stubFetch(REFRESHED);

    const refresh = ctx.intervals.find((i) => i.ms === 15 * 60 * 1000);
    expect(refresh).toBeDefined();
    refresh!.fn();
    // Drain the chain inside refresh.fn(): fetch → res.text → parse → setState.
    // Each await is one microtask boundary; six rounds is overkill but
    // robust against future inserts.
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }

    expect(ctx.state.events?.map((e) => e.title)).toEqual(['Reschedule']);
  });

  test('tick interval calls ctx.render without changing state', async () => {
    stubFetch(SAMPLE_ICS);
    const ctx = makeCtx<CalendarState>();
    await calendarComponent.setup(
      { icalUrl: 'https://example.test/sample.ics' },
      ctx,
    );
    const tick = ctx.intervals.find((i) => i.ms === 30 * 1000);
    tick!.fn();
    expect(ctx.renders).toBe(1);
    expect(ctx.state.events).toBeUndefined();
  });

  test('throws if config.icalUrl is missing', async () => {
    stubFetch(SAMPLE_ICS);
    const ctx = makeCtx<CalendarState>();
    await expect(calendarComponent.setup({}, ctx)).rejects.toThrow(
      /missing required config "icalUrl"/,
    );
  });

  test('rejects if the HTTP response is not ok', async () => {
    stubFetch('not found', false, 404);
    const ctx = makeCtx<CalendarState>();
    await expect(
      calendarComponent.setup(
        { icalUrl: 'https://example.test/missing.ics' },
        ctx,
      ),
    ).rejects.toThrow(/HTTP 404/);
  });

  test('refresh interval swallows fetch errors with a warning', async () => {
    stubFetch(SAMPLE_ICS);
    const ctx = makeCtx<CalendarState>();
    await calendarComponent.setup(
      { icalUrl: 'https://example.test/sample.ics' },
      ctx,
    );

    // Now make the next fetch fail.
    (globalThis as { fetch: typeof fetch }).fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const refresh = ctx.intervals.find((i) => i.ms === 15 * 60 * 1000)!;
    refresh.fn();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('refresh fetch failed'),
    );
  });
});

describe('calendarComponent.render', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-27T08:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('emits Card + Countdown + List for an upcoming event', () => {
    const layout = calendarComponent.render({
      events: [
        { title: 'Standup', start: new Date('2026-05-27T09:00:00Z') },
        { title: 'Design Review', start: new Date('2026-05-27T11:00:00Z') },
      ],
      fetchedAt: Date.now(),
    });

    const card = layout.find((n) => n.type === 'card');
    const countdown = layout.find((n) => n.type === 'countdown');
    const list = layout.find((n) => n.type === 'list');

    expect(card).toMatchObject({
      type: 'card',
      title: 'Next Meeting',
      subtitle: 'Standup',
    });
    expect(countdown).toMatchObject({
      type: 'countdown',
      target: '2026-05-27T09:00:00.000Z',
      label: 'Starts in',
    });
    expect(list).toMatchObject({ type: 'list' });
    expect(
      (list as { items: { title: string }[] }).items.map((i) => i.title),
    ).toEqual(['9:00 AM — Standup', '11:00 AM — Design Review']);
  });

  test('hides past events from upcoming view', () => {
    jest.setSystemTime(new Date('2026-05-27T10:00:00Z'));
    const layout = calendarComponent.render({
      events: [
        { title: 'Standup', start: new Date('2026-05-27T09:00:00Z') },
        { title: 'Design Review', start: new Date('2026-05-27T11:00:00Z') },
      ],
      fetchedAt: Date.now(),
    });
    const card = layout.find((n) => n.type === 'card') as {
      type: 'card';
      subtitle?: string;
    };
    expect(card.subtitle).toBe('Design Review');
  });

  test('shows "No upcoming meetings" when nothing is pending', () => {
    jest.setSystemTime(new Date('2026-05-27T15:00:00Z'));
    const layout = calendarComponent.render({
      events: [
        { title: 'Standup', start: new Date('2026-05-27T09:00:00Z') },
      ],
      fetchedAt: Date.now(),
    });
    const card = layout.find((n) => n.type === 'card') as {
      type: 'card';
      title: string;
    };
    expect(card.title).toBe('No upcoming meetings');
    // No countdown when there's nothing to count down to.
    expect(layout.find((n) => n.type === 'countdown')).toBeUndefined();
  });
});
