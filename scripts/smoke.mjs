// Renders the app once per design and asserts the expected content appears.
//
// There is no browser automation in this environment, so this is the substitute: it catches the
// failures that matter most in a view-switching app — a view that throws on mount, a filter that
// silently returns nothing, a date helper that crashes on an all-day event. It renders the real
// App component against the real snapshot through react-dom/server.
//
// Usage: node scripts/smoke.mjs

import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/'
});

// renderToString does not run effects, but it does run useState initializers — and those read
// window.location and localStorage via usePreferences. So the DOM globals have to exist first.
const store = new Map();
globalThis.window = dom.window;
globalThis.document = dom.window.document;
// Node 24 defines `navigator` as a getter-only global, so it has to be redefined rather than assigned.
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};

const OUT = 'node_modules/.smoke-bundle.cjs';

await build({
  entryPoints: ['scripts/smoke-entry.jsx'],
  bundle: true,
  outfile: OUT,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  loader: { '.json': 'json' },
  logLevel: 'error'
});

const require = createRequire(import.meta.url);
const { render } = require(`../${OUT}`);

let failures = 0;
const check = (name, condition, detail = '') => {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

function renderWith(search) {
  dom.reconfigure({ url: `http://localhost/${search}` });
  return render();
}

console.log('\nViews render:');
// Each surface asserts against the chrome it is supposed to render. The two BYU recreations carry
// BYU's own wording; the three concepts carry ours.
const VIEW_MARKERS = {
  web: 'Events Calendar',
  app: 'Calendar',
  feed: 'Campus Calendar',
  discover: 'Campus Calendar',
  planner: 'Campus Calendar'
};
for (const [view, marker] of Object.entries(VIEW_MARKERS)) {
  let html = '';
  let error = null;
  try {
    html = renderWith(`?view=${view}`);
  } catch (err) {
    error = err;
  }
  check(`${view} renders`, !error && html.length > 5000, error?.message ?? `${html.length} bytes`);
  check(`${view} shows its own chrome`, html.includes(marker));
  // Every surface must offer the view switcher, or there is no way back out of it.
  check(`${view} offers the view switcher`, html.includes('BYU Website') && html.includes('Planner'));
}

console.log('\nNavigation:');
// The retired `campus` id must still resolve, or links shared before the rename break.
check(
  'legacy ?design=campus still resolves to BYU Website',
  renderWith('?design=campus').includes('Events Calendar')
);
check('legacy ?design=feed still resolves', renderWith('?design=feed').includes('Campus Calendar'));
const appHtml = renderWith('?view=app');
check(
  'app surface offers all four layouts',
  ['Day', 'Feed', 'Discover', 'Month'].every((m) => appHtml.includes(m))
);
check('app surface renders its bottom tab bar', appHtml.includes('Home') && appHtml.includes('Search'));
check('app surface honours ?mode=month', renderWith('?view=app&mode=month').includes('Tap a day to open it'));

console.log('\nPWA:');
const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
check('manifest has a name and start_url', Boolean(manifest.name && manifest.start_url));
check('manifest is standalone', manifest.display === 'standalone');
check(
  'manifest ships both any and maskable icons',
  manifest.icons.some((i) => i.purpose === 'any') && manifest.icons.some((i) => i.purpose === 'maskable')
);
check(
  'every manifest icon file exists',
  manifest.icons.every((i) => existsSync(`public${i.src}`)),
  manifest.icons
    .filter((i) => !existsSync(`public${i.src}`))
    .map((i) => i.src)
    .join(', ')
);
check('apple-touch-icon exists', existsSync('public/icons/apple-touch-icon.png'));
const indexHtml = readFileSync('index.html', 'utf8');
check('index.html links the manifest', indexHtml.includes('rel="manifest"'));
check('index.html links an apple-touch-icon', indexHtml.includes('apple-touch-icon'));
// A cached .ics would silently stop updating a subscriber's calendar, so the worker must skip it.
check('service worker never caches the calendar feed', readFileSync('public/sw.js', 'utf8').includes("'/feed.ics'"));

console.log('\nFilters narrow results:');
const snapshot = JSON.parse(readFileSync('src/data/events.json', 'utf8'));
const football = snapshot.events.filter((e) => e.interests.includes('football'));

const footballHtml = renderWith('?view=feed&interests=football');
check('football filter shows a football game', footballHtml.includes('Football vs.'));
check(
  'football filter excludes basketball',
  !footballHtml.includes('Basketball vs.'),
  'basketball leaked into a football-only feed'
);
check(`snapshot actually has football games`, football.length > 0, `${football.length} found`);

const searchHtml = renderWith('?view=feed&q=notre%20dame');
check('search finds "notre dame"', searchHtml.includes('Notre Dame'));

const emptyHtml = renderWith('?view=feed&q=zzzzznotathing');
check('a hopeless search shows the empty state', emptyHtml.includes('No events match'));

const zeroCoverage = renderWith('?view=feed&interests=hackathon');
check(
  'a zero-coverage interest explains itself',
  zeroCoverage.includes('Nothing scheduled for'),
  'the empty-interest notice did not render'
);

const multi = renderWith('?view=planner&interests=football,dance');
check('planner renders a multi-interest selection', multi.includes('Planner') || multi.length > 5000);

// The BYU Website surface recreates calendar.byu.edu, so its markers are BYU's, not ours.
const web = renderWith('?view=web');
check('web renders the BYU chrome', web.includes('Events Calendar') && web.includes('Submit an Event'));
check('web renders the BYU footer', web.includes('All Rights Reserved'));
check('web groups into category rows', web.includes('Full Schedule'));
check('web exposes the added feature bar', web.includes('My interests') && web.includes('This weekend'));
const webFiltered = renderWith('?view=web&interests=football');
check('web respects interest filters', webFiltered.includes('Football vs.') && !webFiltered.includes('Basketball vs.'));
const appFiltered = renderWith('?view=app&interests=football');
check('app respects interest filters', appFiltered.includes('Football vs.') && !appFiltered.includes('Basketball vs.'));

const freeHtml = renderWith('?view=discover&free=1');
check('discover renders with freeOnly', freeHtml.length > 5000);

console.log('\nSnapshot integrity:');
check('every event has a parseable start', snapshot.events.every((e) => !Number.isNaN(Date.parse(e.start))));
check('every event has at least one interest', snapshot.events.every((e) => e.interests.length > 0));
check(
  'every interest on an event exists in the catalog',
  (() => {
    const known = new Set(snapshot.groups.flatMap((g) => g.interests.map((i) => i.id)));
    const orphans = [...new Set(snapshot.events.flatMap((e) => e.interests))].filter((i) => !known.has(i));
    if (orphans.length) console.log(`       orphans: ${orphans.join(', ')}`);
    return orphans.length === 0;
  })()
);
check('starts carry an explicit offset', snapshot.events.every((e) => /[+-]\d{2}:\d{2}$/.test(e.start)));

rmSync(OUT, { force: true });

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
