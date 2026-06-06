/**
 * Tiny pure-JS iCalendar parser for the no-hands-tvos PoC.
 *
 * Scope (intentionally minimal):
 *   - extracts every VEVENT in a VCALENDAR
 *   - reads SUMMARY (event title) and DTSTART (start time)
 *   - parses basic-format UTC DTSTART (e.g. `20260527T090000Z`) and the
 *     extended ISO-8601 form some providers emit
 *   - unfolds RFC 5545 continuation lines (a leading space/tab on the next
 *     line means it continues the previous one)
 *
 * Out of scope: recurrence (RRULE), timezones (TZID), VTODO/VJOURNAL,
 * attendees, alarms. The point of this milestone is "fetch + parse + render"
 * on Hermes, not a full iCal implementation.
 */

export type Event = {
  /** SUMMARY value from the VEVENT. */
  title: string;
  /** DTSTART, normalised to a JS Date in UTC. */
  start: Date;
};

/**
 * Parse a complete iCal payload and return its VEVENTs as `Event`s, sorted
 * by start time ascending. Malformed events (no DTSTART, unparseable date,
 * missing SUMMARY) are silently dropped rather than throwing — a real-world
 * feed will sometimes contain garbage and the running app should degrade
 * gracefully.
 */
export function parseICalSimple(input: string): Event[] {
  if (typeof input !== 'string' || input.length === 0) {
    return [];
  }
  const lines = unfold(input);
  const events: Event[] = [];

  let current: { title?: string; start?: Date } | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current && current.title && current.start) {
        events.push({ title: current.title, start: current.start });
      }
      current = null;
      continue;
    }
    if (!current) {
      continue;
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) {
      continue;
    }
    const namePart = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    // Property name may be followed by ;PARAMs (e.g. DTSTART;TZID=...).
    // We ignore params for this PoC.
    const name = namePart.split(';')[0].toUpperCase();
    if (name === 'SUMMARY') {
      current.title = unescapeText(value);
    } else if (name === 'DTSTART') {
      const d = parseICalDate(value);
      if (d) {
        current.start = d;
      }
    }
  }

  events.sort((a, b) => a.start.getTime() - b.start.getTime());
  return events;
}

/**
 * Unfold RFC 5545 continuation lines. Per spec, a CRLF followed by a single
 * whitespace character (space or tab) means the next line continues the
 * previous one. We also accept bare LF since real-world iCal is messy.
 */
function unfold(input: string): string[] {
  const normalised = input.replace(/\r\n/g, '\n');
  const raw = normalised.split('\n');
  const out: string[] = [];
  for (const line of raw) {
    if (line.length > 0 && (line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/**
 * Parse an iCal DATE-TIME value. We accept:
 *   - basic UTC: 20260527T090000Z
 *   - basic floating local: 20260527T090000  (treated as UTC for PoC)
 *   - basic date-only: 20260527             (midnight UTC)
 *   - ISO-8601 extended: 2026-05-27T09:00:00Z (some providers send this)
 *
 * Returns `null` for anything we can't make sense of.
 */
export function parseICalDate(value: string): Date | null {
  const v = value.trim();
  if (v.length === 0) {
    return null;
  }
  // Extended ISO-8601 — let JS parse it directly.
  if (v.includes('-')) {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : new Date(t);
  }
  // Basic iCal: YYYYMMDD or YYYYMMDDTHHMMSS[Z]
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/);
  if (!m) {
    return null;
  }
  const [, y, mo, d, hh = '00', mm = '00', ss = '00'] = m;
  const iso = `${y}-${mo}-${d}T${hh}:${mm}:${ss}Z`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t);
}

/**
 * Decode the iCal TEXT escape sequences we're likely to encounter in a
 * SUMMARY: backslash-n → newline, backslash-comma → comma, backslash-
 * semicolon → semicolon, backslash-backslash → backslash.
 */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\N/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}
