/**
 * Live config for the Milestone 3 Calendar component.
 *
 * The iCal feed lives in a separate repo (`jpshackelford/nohands-extensions`)
 * so the running app fetches data over a stable, externally-hosted URL —
 * the way a real shared component runtime would in production. This also
 * avoids the chicken-and-egg of the no-hands-tvos PR trying to self-host the
 * fixture it's introducing.
 */
export const CALENDAR_ICAL_URL =
  'https://raw.githubusercontent.com/jpshackelford/nohands-extensions/main/fixtures/sample.ics';
