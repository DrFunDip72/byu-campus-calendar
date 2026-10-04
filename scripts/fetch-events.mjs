// Builds src/data/events.json: the committed snapshot the app ships with.
//
// Why a build-time snapshot instead of fetching at runtime:
//   1. calendar.byu.edu sits behind CloudFront, which 403s some datacenter IP ranges. A runtime
//      fetch from a serverless function is therefore not reliably available; a committed snapshot
//      always is. (api/events.ts still tries live and falls back to this file.)
//   2. The API caps each response at ~100 events, so a full 9-month pull is ~40 sequential HTTP
//      requests. That is a fine build step and a terrible page load.
//   3. The feed is public, identical for every student, and changes a few times a day at most.
//
// Refreshed daily by .github/workflows/refresh-events.yml, which commits the result.
//
// Usage: node scripts/fetch-events.mjs [--days 270]

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveInterests, deriveOrgs, INTEREST_GROUPS, FALLBACK_INTERESTS } from './taxonomy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'data', 'events.json');

/**
 * `categories=all`, per the official docs at calendar.byu.edu/events-api.
 *
 * This replaced an explicit list of the nine main category ids from /api/Categories. The docs claim
 * "including all main categories means to include all events (as one main level category is
 * required for all events)" — **that is not true in practice.** Measured over the same week, the
 * nine main ids return 35 events and `all` returns 40. The extras have a non-main category as their
 * primary one: "School of Music" (Jazz Showcase, OcTUBAfest, Fall Choral Showcase), "BRAVO! Events",
 * and "Academic Calendar" deadlines. Over 365 days this is the difference between 404 and 626 raw
 * records — a ~55% undercount that failed silently.
 *
 * /api/AllCategories documents the three category types behind this: main categories, tags, and
 * internal categories (departments and groups).
 */
const CATEGORIES = 'all';
const DAY_MS = 86_400_000;
const CHUNK_DAYS = 7; // keeps every window well under the ~100-event response cap
const DAYS = Number(process.argv[process.argv.indexOf('--days') + 1]) || 270;

const ymd = (d) => d.toISOString().slice(0, 10);
const stripHtml = (s) =>
  String(s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const splitList = (s) =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * The API returns "2026-10-09 20:15:00" with a separate Timezone field, i.e. Denver wall time with
 * no offset. `new Date()` would read that as the *viewer's* local time, so a student checking the
 * calendar from an internship in New York would see every kickoff two hours late. We attach the
 * correct Denver offset here, once, at ingest — MDT (-06:00) until Nov 1 2026, MST (-07:00) after.
 */
function denverIso(wallTime) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(wallTime ?? '').trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s = '00'] = m;
  const offset = denverOffset(+y, +mo, +d);
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`;
}

// US DST: second Sunday in March to first Sunday in November.
function denverOffset(year, month, day) {
  const dstStart = nthWeekdayOfMonth(year, 3, 0, 2);
  const dstEnd = nthWeekdayOfMonth(year, 11, 0, 1);
  const date = Date.UTC(year, month - 1, day);
  return date >= dstStart && date < dstEnd ? '-06:00' : '-07:00';
}

function nthWeekdayOfMonth(year, month, weekday, n) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const shift = (weekday - first.getUTCDay() + 7) % 7;
  return Date.UTC(year, month - 1, 1 + shift + (n - 1) * 7);
}

async function fetchJson(url, label) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'user-agent': 'byu-campus-calendar/1.0 (+student project)' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === 3) throw new Error(`${label}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}

// ---------------------------------------------------------------------------
// Source 1: the main BYU Calendar API (calendar.byu.edu)
// ---------------------------------------------------------------------------
async function fetchByuCalendar(days) {
  const today = new Date();
  const out = [];
  let windows = 0;
  let truncated = 0;
  for (let offset = 0; offset < days; offset += CHUNK_DAYS) {
    const min = new Date(today.getTime() + offset * DAY_MS);
    const max = new Date(today.getTime() + Math.min(offset + CHUNK_DAYS, days) * DAY_MS);
    const url =
      `https://calendar.byu.edu/api/Events.json?categories=${CATEGORIES}` +
      `&event%5Bmin%5D%5Bdate%5D=${ymd(min)}&event%5Bmax%5D%5Bdate%5D=${ymd(max)}`;
    let items;
    try {
      items = await fetchJson(url, `window ${ymd(min)}`);
    } catch (err) {
      console.warn(`  ! skipped ${ymd(min)}..${ymd(max)}: ${err.message}`);
      continue;
    }
    windows++;
    if (items.length >= 100) {
      truncated++;
      console.warn(`  ! window ${ymd(min)}..${ymd(max)} returned ${items.length}; may be capped`);
    }
    for (const e of items) out.push(normalizeByu(e));
  }
  console.log(`byu_calendar: ${out.length} rows from ${windows} windows${truncated ? ` (${truncated} possibly capped)` : ''}`);
  return out;
}

function normalizeByu(e) {
  const description = stripHtml(e.Description);
  const tags = splitList(e.TagsNames);
  const base = {
    id: `byu:${e.OccurrenceId || e.EventId}:${String(e.StartDateTime ?? '').slice(0, 10)}`,
    title: stripHtml(e.Title),
    start: denverIso(e.StartDateTime),
    end: denverIso(e.EndDateTime),
    allDay: e.AllDay === 'true',
    location: (e.LocationName || e.field_event_location || '').trim() || null,
    category: e.CategoryName || 'Other',
    tags,
    description,
    summary: stripHtml(e.ShortDescription) || null,
    image: e.ImgUrl || null,
    imageAlt: stripHtml(e.ImgAlt) || null,
    url: e.FullUrl || e.MoreInformationUrl || null,
    ticketsUrl: e.TicketsUrl || null,
    free: e.IsFree === 'true' && !(e.TicketsExist || '').trim().toLowerCase().startsWith('yes'),
    priceLow: Number(e.LowPrice) || 0,
    priceHigh: Number(e.HighPrice) || 0,
    source: 'byu_calendar'
  };
  base.orgs = deriveOrgs(base, splitList(e.DeptNames));
  base.interests = deriveInterests(base);
  return base;
}

// ---------------------------------------------------------------------------
// Source 2: the CS department calendar (cs.byu.edu), via the per-event ICS files.
// Carried over from the hackathon project. It is here to prove the multi-source shape of the
// pipeline, not for volume: it contributes a handful of events the main calendar misses, which is
// exactly the fragmentation this project exists to fix.
// ---------------------------------------------------------------------------
const CS_BASE = 'https://cs.byu.edu';

const unescapeIcs = (s) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

function extractEventLinks(html) {
  const links = new Set();
  for (const m of html.matchAll(/href=["']((?:https?:\/\/cs\.byu\.edu)?\/[a-z0-9-]+-\d{4}-\d{2}-\d{2})\/?["']/gi)) {
    links.add(m[1].startsWith('http') ? m[1] : `${CS_BASE}${m[1]}`);
  }
  return [...links];
}

function extractIcsLink(html) {
  const m = /href=["']((?:https?:\/\/cs\.byu\.edu)?\/_event\.ics\?e=[\w-]+)["']/i.exec(html);
  if (!m) return null;
  return (m[1].startsWith('http') ? m[1] : `${CS_BASE}${m[1]}`).replace(/&amp;/g, '&');
}

// ICS value -> Denver wall time "YYYY-MM-DD HH:MM:SS". Handles UTC ("...Z"), TZID and floating.
function icsToDenverWall(value) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z?)$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00', s = '00', z] = m;
  if (!z) return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

function parseIcs(ics) {
  const unfolded = ics.replace(/\r?\n[ \t]/g, '');
  const body = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/.exec(unfolded)?.[1];
  if (!body) return null;
  const props = {};
  for (const line of body.split(/\r?\n/)) {
    const m = /^([A-Z-]+)((?:;[^:]*)?):(.*)$/.exec(line);
    if (m) props[m[1]] = m[3];
  }
  const text = (k) => (props[k] ? unescapeIcs(props[k]).trim() : '');
  const date = (k) => (props[k] ? icsToDenverWall(props[k]) : null);
  return {
    title: text('SUMMARY'),
    start: date('DTSTART'),
    end: date('DTEND'),
    location: text('LOCATION'),
    description: text('DESCRIPTION'),
    uid: text('UID')
  };
}

async function getText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'byu-campus-calendar/1.0 (+student project)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchCsDepartment() {
  const out = [];
  let links = [];
  try {
    links = extractEventLinks(await getText(`${CS_BASE}/department/event-calendar`));
  } catch (err) {
    console.warn(`cs_dept: listing unavailable (${err.message}); skipping source`);
    return out;
  }
  for (const link of links) {
    try {
      const html = await getText(link);
      const icsUrl = extractIcsLink(html);
      if (!icsUrl) throw new Error('no ICS link on page');
      const ev = parseIcs(await getText(icsUrl));
      if (!ev?.title || !ev.start) throw new Error('ICS missing title or start');
      const base = {
        id: `cs:${link.split('/').pop()}`,
        title: ev.title,
        start: denverIso(ev.start),
        end: denverIso(ev.end),
        allDay: false,
        location: ev.location || null,
        category: 'Education',
        tags: ['Computer Science'],
        description: ev.description || '',
        summary: null,
        image: null,
        imageAlt: null,
        url: link,
        ticketsUrl: null,
        free: true,
        priceLow: 0,
        priceHigh: 0,
        source: 'cs_dept'
      };
      base.orgs = ['Computer Science Department'];
      base.interests = deriveInterests(base);
      out.push(base);
    } catch (err) {
      console.warn(`  ! cs_dept skipped ${link}: ${err.message}`);
    }
  }
  console.log(`cs_dept: ${out.length} rows from ${links.length} links`);
  return out;
}

// ---------------------------------------------------------------------------

/**
 * Two sources describing one campus double-report some events, and they do not agree on the title:
 * the CS department calls it "Grad School Fair" and the main calendar calls it "Graduate School
 * Fair", same room, same minute. An exact-title key misses that, so dedupe runs in two passes —
 * exact normalized title first (cheap, catches re-ingests), then fuzzy within each start minute.
 *
 * Merging always keeps the richer record (image, longer description, a link) so a merge can never
 * downgrade a listing, and records both source ids so the UI can show provenance.
 */
const score = (e) => (e.image ? 2 : 0) + (e.description?.length ?? 0) / 1000 + (e.url ? 0.5 : 0);

const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'at', 'in', 'for', 'to', 'vs', 'with', 'on']);

const titleTokens = (title) =>
  new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !STOP_WORDS.has(w))
  );

/**
 * Tokens count as the same word when one is a prefix of the other and at least four characters
 * long, which is what makes "Grad School Fair" match "Graduate School Fair". The four-character
 * floor is what keeps it safe: "bas" would otherwise merge basketball into baseball, and "mens" is
 * deliberately not a prefix of "womens", so the gendered sports stay separate.
 */
const sameWord = (a, b) =>
  a === b || (a.length >= 4 && b.startsWith(a)) || (b.length >= 4 && a.startsWith(b));

/** True when two titles are the same event worded differently. */
function sameEventTitle(a, b) {
  const ta = [...titleTokens(a)];
  const tb = [...titleTokens(b)];
  if (!ta.length || !tb.length) return false;
  const shared = ta.filter((w) => tb.some((x) => sameWord(w, x))).length;
  // Measured against the shorter title, so a terse alias still matches its fuller form. The bar
  // stays high enough that "Softball vs. Utah Tech" and "Softball vs. Utah Valley" never collapse.
  return shared / Math.min(ta.length, tb.length) >= 0.75;
}

function merge(a, b) {
  const sources = [...new Set([...a.source.split('+'), ...b.source.split('+')])].sort().join('+');
  const richer = score(b) > score(a) ? b : a;
  const other = richer === a ? b : a;
  return {
    ...richer,
    source: sources,
    // A merged record should carry every tag and interest either source knew about.
    tags: [...new Set([...richer.tags, ...other.tags])],
    orgs: [...new Set([...richer.orgs, ...other.orgs])],
    interests: [...new Set([...richer.interests, ...other.interests])],
    url: richer.url ?? other.url,
    ticketsUrl: richer.ticketsUrl ?? other.ticketsUrl,
    location: richer.location ?? other.location
  };
}

function dedupe(rows) {
  const byKey = new Map();
  for (const e of rows) {
    if (!e.start || !e.title) continue;
    const key = `${e.title.toLowerCase().replace(/[^a-z0-9]+/g, '')}|${e.start.slice(0, 16)}`;
    const existing = byKey.get(key);
    byKey.set(key, existing ? merge(existing, e) : e);
  }

  const byMinute = new Map();
  for (const e of byKey.values()) {
    const minute = e.start.slice(0, 16);
    const bucket = byMinute.get(minute) ?? [];
    const hit = bucket.findIndex((other) => sameEventTitle(other.title, e.title));
    if (hit === -1) bucket.push(e);
    else bucket[hit] = merge(bucket[hit], e);
    byMinute.set(minute, bucket);
  }

  return [...byMinute.values()].flat().sort((a, b) => a.start.localeCompare(b.start));
}

async function main() {
  console.log(`Fetching ${DAYS} days of BYU campus events...`);
  const [byu, cs] = await Promise.all([fetchByuCalendar(DAYS), fetchCsDepartment()]);
  const events = dedupe([...byu, ...cs]);
  if (!events.length) {
    console.error('No events fetched; refusing to write an empty snapshot over a good one.');
    process.exit(1);
  }

  const counts = {};
  for (const e of events) for (const i of e.interests) counts[i] = (counts[i] ?? 0) + 1;
  const orgs = [...new Set(events.flatMap((e) => e.orgs))].sort();

  // The interest catalog ships *with* the data rather than being restated in the frontend. The
  // regexes live in exactly one file (taxonomy.mjs); the UI only ever needs ids, labels and groups,
  // so emitting them here makes drift between the classifier and the filter chips impossible.
  const groups = INTEREST_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    interests: [
      ...g.interests.map((i) => ({ id: i.id, label: i.label })),
      ...FALLBACK_INTERESTS.filter((f) => f.group === g.id).map((f) => ({ id: f.id, label: f.label }))
    ]
      // An interest with no upcoming events is still listed (students should be able to follow
      // "Hackathons" before one is scheduled) but sorted after the ones that do, so the panel leads
      // with what is actually happening.
      .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0) || a.label.localeCompare(b.label))
  }));

  const payload = {
    generatedAt: new Date().toISOString(),
    windowDays: DAYS,
    sources: [
      { id: 'byu_calendar', label: 'BYU Calendar', url: 'https://calendar.byu.edu', count: byu.length },
      { id: 'cs_dept', label: 'CS Department', url: 'https://cs.byu.edu/department/event-calendar', count: cs.length }
    ],
    groups,
    orgs,
    interestCounts: counts,
    events
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 1)}\n`);
  console.log(
    `\nWrote ${events.length} unique events to src/data/events.json` +
      `\n  ${events[0].start.slice(0, 10)} -> ${events[events.length - 1].start.slice(0, 10)}` +
      `\n  ${orgs.length} organizations, ${Object.keys(counts).length} interests in use`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
