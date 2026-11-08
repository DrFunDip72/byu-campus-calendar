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

console.log('\nSurfaces render:');
// Each placement asserts against the chrome it is supposed to render. The two BYU recreations
// carry BYU's own wording; the purpose-built one carries ours. Every layout is exercised in every
// placement, because "all nine combinations work" is the claim the navigation rewrite makes.
const PLACEMENT_MARKERS = {
  web: 'Events Calendar',
  app: 'Calendar',
  standalone: 'Campus Calendar'
};
const LAYOUT_IDS = ['list', 'cards', 'month'];

for (const [placement, marker] of Object.entries(PLACEMENT_MARKERS)) {
  for (const layout of LAYOUT_IDS) {
    let html = '';
    let error = null;
    try {
      html = renderWith(`?placement=${placement}&layout=${layout}`);
    } catch (err) {
      error = err;
    }
    check(
      `${placement} + ${layout} renders`,
      !error && html.length > 5000,
      error?.message ?? `${html.length} bytes`
    );
    check(`${placement} + ${layout} shows its own chrome`, html.includes(marker));
  }
}

// Both axes must stay reachable from every surface, or there is no way back out of one.
for (const placement of Object.keys(PLACEMENT_MARKERS)) {
  const html = renderWith(`?placement=${placement}`);
  check(
    `${placement} offers both switcher axes`,
    html.includes('Where this lives') && html.includes('Layout')
  );
  check(
    `${placement} offers all three layout names`,
    ['List', 'Cards', 'Month'].every((m) => html.includes(m))
  );
}

console.log('\nNavigation:');
// The retired flat ids must still resolve, or links already shared publicly break. `campus` was
// the original id for the BYU Website surface; `feed`/`discover`/`planner` were the concepts.
check(
  'legacy ?design=campus still resolves to BYU Website',
  renderWith('?design=campus').includes('Events Calendar')
);
check('legacy ?design=feed still resolves', renderWith('?design=feed').includes('Campus Calendar'));
check(
  'legacy ?view=planner still resolves',
  renderWith('?view=planner').includes('Campus Calendar')
);
check(
  'legacy ?view=discover still resolves',
  renderWith('?view=discover').includes('Campus Calendar')
);
// An explicit ?layout= must beat a legacy ?view= that implies a different one.
check(
  'explicit ?layout= overrides a legacy ?view=',
  renderWith('?view=discover&layout=month').length > 5000
);

const appHtml = renderWith('?placement=app');
check('app placement renders its bottom tab bar', appHtml.includes('Home') && appHtml.includes('Search'));

// The in-app pill row and the header row are two handles on one piece of state. They were briefly
// two controls over two vocabularies — the header said "List" while the pill said "Feed" — which
// made the header look broken, and the fourth "Day" pill mapped to no global layout so clicking it
// did nothing at all. Both regressions are cheap to reintroduce and invisible without these.
const appLayoutNav = appHtml.slice(appHtml.indexOf('aria-label="Calendar layout"'));
const appNavSlice = appLayoutNav.slice(0, appLayoutNav.indexOf('</nav>'));
check(
  'app layout pills use the global layout names',
  ['List', 'Cards', 'Month'].every((l) => appNavSlice.includes(l)),
  appNavSlice.slice(0, 200)
);
check(
  'app layout pills expose no dead Day tab by default',
  !appNavSlice.includes('Day'),
  'a Day pill rendered without ?mode=day, and it maps to no global layout'
);
for (const layout of ['list', 'cards', 'month']) {
  const html = renderWith(`?placement=app&layout=${layout}`);
  const nav = html.slice(html.indexOf('aria-label="Calendar layout"'));
  check(
    `app layout ${layout} marks itself current in the in-app pills`,
    nav.slice(0, nav.indexOf('</nav>')).includes('aria-current="true"'),
    'the header changed layout but the phone pills did not follow'
  );
}
const dayHtml = renderWith('?placement=app&mode=day');
const dayNav = dayHtml.slice(dayHtml.indexOf('aria-label="Calendar layout"'));
check(
  'the day-only original is labelled when pinned',
  dayNav.slice(0, dayNav.indexOf('</nav>')).includes('today'),
  '?mode=day did not announce itself as today’s app'
);

// Filters belong inside the phone, not in a browser-edge drawer beside a phone mock.
const appSource = readFileSync('src/App.tsx', 'utf8');
check(
  'the desktop filter drawer is suppressed on the app placement',
  appSource.includes("placement !== 'app'")
);
check(
  'the app placement receives an in-frame filter panel',
  appSource.includes('filterPanel={panel}')
);
check(
  'the phone frame renders filters inside itself',
  readFileSync('src/views/ByuAppView.tsx', 'utf8').includes('absolute inset-0 z-20')
);
// The day-only original stays reachable for a before/after comparison in a pitch.
check(
  'app placement honours the ?mode=day escape hatch',
  renderWith('?placement=app&mode=day').length > 5000
);
check(
  'app placement honours ?mode=month',
  renderWith('?placement=app&mode=month').includes('Tap a day to open it')
);

// The comparison view is how a reviewer sees all three layouts without a memory test.
const compareSource = readFileSync('src/components/CompareDialog.tsx', 'utf8');
check('compare view renders all three layouts', compareSource.includes('LAYOUTS.map'));
check('compare previews are inert', compareSource.includes('deliberately inert'));

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
// BYU already ships an app, so nothing may prompt a student to install this one. The manifest and
// offline worker stay; the install banner was removed deliberately and must not creep back.
check('no install prompt is shipped', !existsSync('src/components/InstallPrompt.tsx'));
check(
  'pwa.ts only registers the worker',
  // Matches the listener, not the word: the file explains in prose why the install flow was
  // removed, and that explanation should not trip its own guardrail.
  !readFileSync('src/lib/pwa.ts', 'utf8').includes("addEventListener('beforeinstallprompt'")
);
const indexHtml = readFileSync('index.html', 'utf8');
check('index.html links the manifest', indexHtml.includes('rel="manifest"'));
check('index.html links an apple-touch-icon', indexHtml.includes('apple-touch-icon'));
// A cached .ics would silently stop updating a subscriber's calendar, so the worker must skip it.
check('service worker never caches the calendar feed', readFileSync('public/sw.js', 'utf8').includes("'/feed.ics'"));

console.log('\nFilters narrow results:');
const snapshot = JSON.parse(readFileSync('src/data/events.json', 'utf8'));
const football = snapshot.events.filter((e) => e.interests.includes('football'));

const footballHtml = renderWith('?layout=list&interests=football');
check('football filter shows a football game', footballHtml.includes('Football vs.'));
check(
  'football filter excludes basketball',
  !footballHtml.includes('Basketball vs.'),
  'basketball leaked into a football-only feed'
);
check(`snapshot actually has football games`, football.length > 0, `${football.length} found`);

// Derived from the snapshot rather than hardcoded. A literal opponent name ("notre dame") passed
// until the pull window rolled past that game, then failed for a reason unrelated to search.
const searchTarget = snapshot.events.find((e) => e.title.startsWith("Women's Basketball vs. "));
const searchTerm = searchTarget ? searchTarget.title.split('vs. ')[1] : null;
check('snapshot has a searchable opponent', Boolean(searchTerm), 'no basketball fixture found');
if (searchTerm) {
  const searchHtml = renderWith(`?layout=list&q=${encodeURIComponent(searchTerm)}`);
  check(`search finds "${searchTerm}"`, searchHtml.includes(searchTerm));
}

const emptyHtml = renderWith('?layout=list&q=zzzzznotathing');
check('a hopeless search shows the empty state', emptyHtml.includes('No events match'));

// Also derived: `hackathon` used to be empty and is now covered by stand-ins, so hardcoding any
// single interest here is a test that breaks the moment the data improves.
const allInterests = snapshot.groups.flatMap((g) => g.interests.map((i) => i.id));
const emptyInterest = allInterests.find((id) => (snapshot.interestCounts[id] ?? 0) === 0);
check('snapshot still has an uncovered interest to test', Boolean(emptyInterest));
if (emptyInterest) {
  const zeroCoverage = renderWith(`?layout=list&interests=${emptyInterest}`);
  check(
    `an uncovered interest (${emptyInterest}) explains itself`,
    zeroCoverage.includes('Nothing scheduled for'),
    'the empty-interest notice did not render'
  );
}

const multi = renderWith('?layout=month&interests=football,dance');
check('month layout renders a multi-interest selection', multi.length > 5000);

// The BYU Website surface recreates calendar.byu.edu, so its markers are BYU's, not ours.
const web = renderWith('?placement=web');
check('web renders the BYU chrome', web.includes('Events Calendar') && web.includes('Submit an Event'));
check('web renders the BYU footer', web.includes('All Rights Reserved'));
check('web groups into category rows', web.includes('Full Schedule'));
check('web exposes the added feature bar', web.includes('My interests') && web.includes('This weekend'));
const webFiltered = renderWith('?placement=web&interests=football');
check('web respects interest filters', webFiltered.includes('Football vs.') && !webFiltered.includes('Basketball vs.'));
const appFiltered = renderWith('?placement=app&interests=football');
check('app respects interest filters', appFiltered.includes('Football vs.') && !appFiltered.includes('Basketball vs.'));

const freeHtml = renderWith('?layout=cards&free=1');
check('discover renders with freeOnly', freeHtml.length > 5000);

console.log('\nDemo-data honesty:');
// The stand-ins are defensible only while they stay labelled. These checks are that guardrail.
const demoEvents = snapshot.events.filter((e) => e.demo);
check('snapshot carries stand-in events', demoEvents.length > 0, `${demoEvents.length} found`);
check(
  'demoCount matches the flagged events',
  snapshot.demoCount === demoEvents.length,
  `${snapshot.demoCount} declared vs ${demoEvents.length} flagged`
);
check('every stand-in is sourced as demo', demoEvents.every((e) => e.source === 'demo'));
check('no stand-in claims a real BYU url', demoEvents.every((e) => e.url === null));
// Every layout in every placement, not just one. The badge was first added by patching the first
// `{event.title}` in each view, which silently missed the second card component in two of them —
// so the cards layout shipped stand-ins with no label at all. Enumerating catches that class of
// miss, which is the only thing keeping the stand-ins honest.
for (const placement of ['web', 'app', 'standalone']) {
  for (const layout of ['list', 'cards', 'month']) {
    const html = renderWith(`?placement=${placement}&layout=${layout}&interests=club-pma,hackathon`);
    check(
      `${placement} + ${layout} labels its stand-ins`,
      // Three legitimate markers: the inline badge where a title is rendered, the tooltip on
      // compact chips and dots, and the data attribute on the app's month dots.
      html.includes('>Demo<') ||
        html.includes('not a real BYU event') ||
        html.includes('data-demo="true"'),
      'a stand-in rendered with no DEMO marker'
    );
  }
}
const demoHtml = renderWith('?layout=list&interests=club-pma');
check('the honesty banner names the real count', demoHtml.includes('real BYU events'));
// The exported calendar is the one place a badge cannot follow the event, so the title must.
const feedSource = readFileSync('api/feed.ts', 'utf8');
check('the ICS feed prefixes stand-in titles', feedSource.includes('[DEMO] ${event.title}'));
check('the ICS feed explains stand-ins in the description', feedSource.includes('DEMO EVENT'));
check(
  'the About panel discloses the stand-ins',
  readFileSync('src/components/AboutDialog.tsx', 'utf8').includes('illustrative')
);

console.log('\nFeedback capture:');
const feedbackApi = readFileSync('api/feedback.ts', 'utf8');
check('feedback endpoint validates the verdict', feedbackApi.includes('must be "yes" or "no"'));
check('feedback is stored privately', feedbackApi.includes("access: 'private'"));
check('feedback stores no identifiers', !/\\b(ip|email|userAgent|user_agent)\\b/i.test(feedbackApi));
const resultsApi = readFileSync('api/feedback-results.ts', 'utf8');
check('results page requires a key', resultsApi.includes('FEEDBACK_ADMIN_KEY'));
check('results page compares the key in constant time', resultsApi.includes('secretsMatch'));
check('results page is noindex', resultsApi.includes('noindex'));
check('results page escapes comment text', resultsApi.includes('escape(r.comment'));

// The route into the survey has to exist on every screen, not just the one someone happens to be
// on. The previous build hid it behind a footer link and a 25-second timer, so most visitors never
// saw it at all — enumerate rather than spot-check, since one missing corner is the whole failure.
for (const placement of Object.keys(PLACEMENT_MARKERS)) {
  for (const layout of LAYOUT_IDS) {
    const html = renderWith(`?placement=${placement}&layout=${layout}`);
    check(
      `${placement} + ${layout} shows the feedback button`,
      html.includes('aria-label="Give feedback"'),
      'no floating feedback button in this combination'
    );
  }
}
check(
  'the day-only app recreation still shows the feedback button',
  renderWith('?placement=app&mode=day').includes('aria-label="Give feedback"')
);

const feedbackSource = readFileSync('src/components/FeedbackBar.tsx', 'utf8');
// Nothing may interrupt. The button waits to be pressed; it does not schedule its own arrival.
check(
  'the survey never opens itself on a timer',
  !feedbackSource.includes('APPEAR_AFTER_MS'),
  'a timer is scheduling the survey again'
);
// A stored dismissal must not be able to disable the button, the way a stored appMode once
// disabled both layout switchers.
check(
  'no stored dismissal can suppress the feedback button',
  !feedbackSource.includes('localStorage'),
  'FeedbackBar reads localStorage again, which can silently hide the control'
);
// The button vanished once because the component returned the button *or* the survey depending on
// its stage. It must now render in every stage, including while the survey is open.
// Specifically the render-gate shape — a stage test that returns markup or nothing. An early
// `return;` inside an effect is fine and is what a looser pattern kept flagging.
check(
  'the feedback button is never gated on a survey stage',
  !/if \(stage [^\n]*\)\s*\{?\s*\n?\s*return (\(|null)/.test(feedbackSource),
  'the button is behind a stage check again, so some state will hide it'
);
check(
  'the feedback button survives its own pop-up being open',
  (() => {
    const button = feedbackSource.indexOf('aria-label="Give feedback"');
    const popup = feedbackSource.indexOf("{stage !== 'closed' &&");
    return button > 0 && popup > button;
  })(),
  'the button no longer renders ahead of, and outside, the pop-up conditional'
);
// A bar pinned to the bottom edge of a tall page is not a response to a click in the corner.
check(
  'the survey is a centred pop-up, not a bottom bar',
  feedbackSource.includes('items-center justify-center') &&
    !feedbackSource.includes('fixed inset-x-0 bottom-0'),
  'the bottom-edge survey bar is back'
);
check('the survey pop-up is a modal dialog', feedbackSource.includes('aria-modal="true"'));
check(
  'the survey cannot be sent without a verdict',
  feedbackSource.includes('disabled={sending || !verdict}')
);
check(
  'reopening the survey starts from a blank form',
  feedbackSource.includes('const openForm')
);

const welcomeSource = readFileSync('src/components/WelcomeCard.tsx', 'utf8');
check('the arrival card says it is not official BYU', welcomeSource.includes('not an official BYU site'));
check('the arrival card points at the feedback button', welcomeSource.includes('bottom-right corner'));
check('the arrival card explains both axes', welcomeSource.includes('Where it would live'));
check('the arrival card shows only once per browser', welcomeSource.includes('welcome.v1'));
check(
  'the arrival card can be suppressed for a live demo',
  welcomeSource.includes("get('welcome') === '0'")
);
// The URL is rewritten from filter state on every change, so the flag has to be recorded or it is
// gone from the address bar before the first reload.
check(
  'suppressing the arrival card survives a reload',
  welcomeSource.includes("setItem(STORAGE_KEY, 'suppressed')")
);
// On a 375px-wide screen this card's text wraps to nearly twice its laptop height. Inside an
// overflow-hidden box with no cap, that pushed both buttons past the bottom of the viewport.
check(
  'the arrival card scrolls instead of clipping its own buttons',
  welcomeSource.includes('overflow-y-auto') && welcomeSource.includes('max-h-[calc(100vh-7rem)]')
);
check(
  'the feedback button is raised above the arrival card scrim',
  feedbackSource.includes('lifted') && appSource.includes('lifted={welcomeOpen}')
);

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
