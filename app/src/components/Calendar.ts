import type { Component } from '../runtime/types';
import type { PrimitiveDefinition } from '../renderer/types';
import { parseICalSimple, type Event } from '../runtime/ical';

export type CalendarState = {
  events: Event[];
  /** ms since epoch — useful for diagnostics. */
  fetchedAt: number;
};

const REFRESH_MS = 15 * 60 * 1000; // re-fetch every 15 minutes
const TICK_MS = 30 * 1000; // re-render every 30s so the Countdown stays fresh

/**
 * Calendar — the Milestone 3 reference component.
 *
 * `setup()`:
 *   - fetches an iCal feed from `config.icalUrl`
 *   - parses it into `Event[]` and returns initial state
 *   - registers a refresh interval (re-fetch every 15 min) and a tick
 *     interval (forces a re-render every 30 s so the Countdown stays
 *     live without the surrounding state actually changing)
 *
 * `render(state)`:
 *   - emits a `card` for the next event
 *   - emits a `countdown` to its DTSTART
 *   - emits a `list` of up to 5 upcoming events
 *   - if there are no upcoming events, shows a single "No upcoming
 *     meetings" card so the screen is never blank
 */
export const calendarComponent: Component<CalendarState> = {
  id: 'calendar',
  config: {
    icalUrl: { type: 'string', required: true },
  },
  async setup(config, ctx) {
    const url = readUrl(config);

    const events = await fetchAndParse(url);
    // The smoke probe greps for this line. Matching the format from issue #3.
    console.log(`M3: calendar setup resolved (${events.length} events)`);

    ctx.setInterval(() => {
      // Fire-and-forget — errors in periodic refresh are not fatal.
      fetchAndParse(url)
        .then((fresh) => {
          ctx.setState({ events: fresh, fetchedAt: Date.now() });
        })
        .catch((err: unknown) => {
          console.warn(
            `calendar: refresh fetch failed — ${err instanceof Error ? err.message : String(err)}`,
          );
        });
    }, REFRESH_MS);

    // Tick to keep the Countdown's text in sync without mutating state.
    ctx.setInterval(() => ctx.render(), TICK_MS);

    return { events, fetchedAt: Date.now() };
  },
  render(state) {
    const upcoming = upcomingFrom(state.events, Date.now());
    const next = upcoming[0];
    const layout: PrimitiveDefinition[] = [];

    if (next) {
      layout.push({
        type: 'card',
        title: 'Next Meeting',
        subtitle: next.title,
        content: formatTime(next.start),
        focusable: true,
      });
      layout.push({
        type: 'countdown',
        target: next.start.toISOString(),
        label: 'Starts in',
      });
    } else {
      layout.push({
        type: 'card',
        title: 'No upcoming meetings',
        subtitle: state.events.length === 0
          ? 'Feed contained no events'
          : 'All events have passed',
        focusable: true,
      });
    }

    layout.push({
      type: 'list',
      items: upcoming.slice(0, 5).map((e) => ({
        title: `${formatTime(e.start)} — ${e.title}`,
      })),
    });

    return layout;
  },
};

function readUrl(config: Record<string, unknown>): string {
  const url = config.icalUrl;
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('calendar: missing required config "icalUrl"');
  }
  return url;
}

async function fetchAndParse(url: string): Promise<Event[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`calendar: fetch ${url} → HTTP ${res.status}`);
  }
  const body = await res.text();
  return parseICalSimple(body);
}

function upcomingFrom(events: Event[], now: number): Event[] {
  return events.filter((e) => e.start.getTime() >= now);
}

/**
 * Formatter used in both the Card subtitle and the List rows. Intentionally
 * locale-free so unit tests don't drift across machines: `H:MM AM/PM` based
 * on UTC, matching the M2 sample-layout style.
 */
export function formatTime(d: Date): string {
  const h24 = d.getUTCHours();
  const m = d.getUTCMinutes();
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
