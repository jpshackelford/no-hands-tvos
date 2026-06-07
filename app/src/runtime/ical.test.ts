import { parseICalSimple, parseICalDate } from './ical';

const SAMPLE = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//no-hands-tvos//M3 sample//EN',
  'BEGIN:VEVENT',
  'UID:1@example.com',
  'SUMMARY:Standup',
  'DTSTART:20260527T090000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:2@example.com',
  'SUMMARY:Design Review',
  'DTSTART:20260527T110000Z',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n');

describe('parseICalDate', () => {
  test('parses basic UTC form (YYYYMMDDTHHMMSSZ)', () => {
    const d = parseICalDate('20260527T090000Z');
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe('2026-05-27T09:00:00.000Z');
  });

  test('parses basic date-only form (YYYYMMDD) as UTC midnight', () => {
    const d = parseICalDate('20260527');
    expect(d!.toISOString()).toBe('2026-05-27T00:00:00.000Z');
  });

  test('parses extended ISO-8601 form some providers emit', () => {
    const d = parseICalDate('2026-05-27T09:00:00Z');
    expect(d!.toISOString()).toBe('2026-05-27T09:00:00.000Z');
  });

  test('returns null for unparseable input', () => {
    expect(parseICalDate('not a date')).toBeNull();
    expect(parseICalDate('')).toBeNull();
  });
});

describe('parseICalSimple', () => {
  test('extracts every VEVENT with title and start (happy path)', () => {
    const events = parseICalSimple(SAMPLE);
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe('Standup');
    expect(events[0].start.toISOString()).toBe('2026-05-27T09:00:00.000Z');
    expect(events[1].title).toBe('Design Review');
    expect(events[1].start.toISOString()).toBe('2026-05-27T11:00:00.000Z');
  });

  test('sorts events by start time ascending', () => {
    const out = parseICalSimple(
      [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'SUMMARY:Later',
        'DTSTART:20260527T110000Z',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'SUMMARY:Earlier',
        'DTSTART:20260527T090000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
    );
    expect(out.map((e) => e.title)).toEqual(['Earlier', 'Later']);
  });

  test('drops VEVENTs missing DTSTART', () => {
    const out = parseICalSimple(
      [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'SUMMARY:No start',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'SUMMARY:Has start',
        'DTSTART:20260527T090000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
    );
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Has start');
  });

  test('drops VEVENTs missing SUMMARY', () => {
    const out = parseICalSimple(
      [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'DTSTART:20260527T090000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
    );
    expect(out).toHaveLength(0);
  });

  test('ignores DTSTART params (DTSTART;TZID=...)', () => {
    const out = parseICalSimple(
      [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'SUMMARY:With TZID',
        'DTSTART;TZID=America/Los_Angeles:20260527T090000',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
    );
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('With TZID');
    // We treat floating-local as UTC for the PoC — this is intentional and
    // documented in ical.ts. The test asserts the (current) behaviour.
    expect(out[0].start.toISOString()).toBe('2026-05-27T09:00:00.000Z');
  });

  test('unfolds RFC 5545 continuation lines (strips the fold space)', () => {
    // Per RFC 5545: a CRLF followed by a single whitespace char is a fold;
    // unfolding REMOVES that leading whitespace. So "that\r\n was" becomes
    // "thatwas". Real-world feeds that want a space in the content include
    // it explicitly (i.e. they emit a second leading space).
    const out = parseICalSimple(
      'BEGIN:VCALENDAR\r\n' +
        'BEGIN:VEVENT\r\n' +
        'SUMMARY:Long title that wa\r\n' +
        ' s folded\r\n' +
        'DTSTART:20260527T090000Z\r\n' +
        'END:VEVENT\r\n' +
        'END:VCALENDAR\r\n',
    );
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Long title that was folded');
  });

  test('decodes iCal text escapes in SUMMARY', () => {
    const out = parseICalSimple(
      [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'SUMMARY:Foo\\, bar\\; baz',
        'DTSTART:20260527T090000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
    );
    expect(out[0].title).toBe('Foo, bar; baz');
  });

  test('returns [] for empty / non-string input', () => {
    expect(parseICalSimple('')).toEqual([]);
    // @ts-expect-error — exercising defensive handling
    expect(parseICalSimple(undefined)).toEqual([]);
  });

  test('returns [] for input without any VEVENTs (malformed but not crashing)', () => {
    expect(
      parseICalSimple(
        ['BEGIN:VCALENDAR', 'PRODID:foo', 'END:VCALENDAR'].join('\r\n'),
      ),
    ).toEqual([]);
  });
});
