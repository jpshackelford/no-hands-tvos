/**
 * Live config for the Milestone 4 remote-component loader.
 *
 * The bundle is hosted in the sibling `nohands-extensions` repo and
 * served via raw.githubusercontent.com — same pattern as the M3 iCal
 * fixture. Hosting in a separate repo avoids the chicken-and-egg
 * where a PR introduces a fixture/bundle that its own CI smoke would
 * need to fetch *before* the PR's branch is merged into main.
 *
 * `raw.githubusercontent.com` caches for 300s; if you edit a bundle
 * during dev expect ~5 minutes before the running sim sees the change
 * (or append a `?cb=<ts>` query string to bust the cache locally).
 */

export const CALENDAR_BUNDLE_URL =
  'https://raw.githubusercontent.com/jpshackelford/nohands-extensions/main/bundles/calendar.bundle.js';

export const HELLO_BUNDLE_URL =
  'https://raw.githubusercontent.com/jpshackelford/nohands-extensions/main/bundles/hello.bundle.js';
