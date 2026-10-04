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
import { readFileSync, rmSync } from 'node:fs';
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

console.log('\nDesigns render:');
for (const design of ['feed', 'discover', 'planner']) {
  let html = '';
  let error = null;
  try {
    html = renderWith(`?design=${design}`);
  } catch (err) {
    error = err;
  }
  check(`${design} renders`, !error && html.length > 5000, error?.message ?? `${html.length} bytes`);
  check(`${design} shows the switcher`, html.includes('Campus Calendar'));
}

console.log('\nFilters narrow results:');
const snapshot = JSON.parse(readFileSync('src/data/events.json', 'utf8'));
const football = snapshot.events.filter((e) => e.interests.includes('football'));

const footballHtml = renderWith('?design=feed&interests=football');
check('football filter shows a football game', footballHtml.includes('Football vs.'));
check(
  'football filter excludes basketball',
  !footballHtml.includes('Basketball vs.'),
  'basketball leaked into a football-only feed'
);
check(`snapshot actually has football games`, football.length > 0, `${football.length} found`);

const searchHtml = renderWith('?design=feed&q=notre%20dame');
check('search finds "notre dame"', searchHtml.includes('Notre Dame'));

const emptyHtml = renderWith('?design=feed&q=zzzzznotathing');
check('a hopeless search shows the empty state', emptyHtml.includes('No events match'));

const zeroCoverage = renderWith('?design=feed&interests=hackathon');
check(
  'a zero-coverage interest explains itself',
  zeroCoverage.includes('Nothing scheduled for'),
  'the empty-interest notice did not render'
);

const multi = renderWith('?design=planner&interests=football,dance');
check('planner renders a multi-interest selection', multi.includes('Planner') || multi.length > 5000);

const freeHtml = renderWith('?design=discover&free=1');
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
