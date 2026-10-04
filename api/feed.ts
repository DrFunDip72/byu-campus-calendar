/**
 * GET /api/feed  (public URL: /feed.ics, rewritten in vercel.json)
 *
 * A live iCalendar feed of the events matching a filter set, so a student's choices in the UI
 * become a calendar subscription instead of a page they have to remember to revisit.
 *
 * Query parameters are the same ones the UI puts in its own address bar, which is what lets the
 * Subscribe dialog build this URL by serializing the filters it already has:
 *
 *   interests=football,dance,hackathon   followed interest ids (OR-ed)
 *   orgs=BYU%20Athletics                 hosting organizations (OR-ed)
 *   q=notre%20dame                       free-text search
 *   free=1                               free events only
 *   all=1                                ignore `interests` and return everything
 *
 * Responses:
 *   200 text/calendar
 *   400 an unknown interest id was requested (a typo should not silently return an empty calendar)
 *
 * Note on time: the snapshot stores each start/end as an ISO string with the correct Denver offset
 * already applied, so converting to the UTC stamps iCalendar wants is just `toISOString()`. No
 * timezone table is needed at request time.
 */

import { readFileSync } from 'node:fs';

interface FeedEvent {
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  location: string | null;
  category: string;
  tags: string[];
  orgs: string[];
  interests: string[];
  description: string;
  summary: string | null;
  url: string | null;
  ticketsUrl: string | null;
  free: boolean;
}

/**
 * The snapshot is read off disk rather than `import`ed.
 *
 * This package is ESM (`"type": "module"`), and Vercel deploys this file as real ESM, where Node
 * rejects a bare JSON import: `ERR_IMPORT_ATTRIBUTE_MISSING`. Vite's dev server transforms JSON
 * imports for you, so a static import works locally and 500s in production — exactly the failure
 * that is hardest to catch. `readFileSync` behaves identically in both.
 *
 * vercel.json pins `includeFiles` for this function so the file is bundled; without it, Vercel's
 * dependency tracing has no static import to follow and would leave it out.
 */
const DATA = JSON.parse(
  readFileSync(new URL('../src/data/events.json', import.meta.url), 'utf8')
) as {
  generatedAt: string;
  groups: { id: string; label: string; interests: { id: string; label: string }[] }[];
  events: FeedEvent[];
};

const KNOWN_INTERESTS = new Set(DATA.groups.flatMap((g) => g.interests.map((i) => i.id)));
const INTEREST_LABELS = new Map(DATA.groups.flatMap((g) => g.interests.map((i) => [i.id, i.label])));

/** How far ahead a subscription reaches. Calendar clients handle a year fine. */
const WINDOW_DAYS = 365;

const utcStamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const dayStamp = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
  return parts.replace(/-/g, '');
};

const escapeText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n|\r/g, '\\n');

/** Folds a content line at 75 octets without splitting a multi-byte character (RFC 5545 3.1). */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) {
      parts.push(current);
      current = ' '; // continuation lines start with one space, which counts toward their 75
      bytes = 1;
    }
    current += char;
    bytes += size;
  }
  if (current.trim()) parts.push(current);
  return parts.join('\r\n');
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function matchesQuery(event: FeedEvent, query: string): boolean {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (!terms.length) return true;
  const hay = normalize(
    [
      event.title,
      event.location ?? '',
      event.category,
      ...event.orgs,
      ...event.tags,
      ...event.interests.map((i) => INTEREST_LABELS.get(i) ?? i),
      event.summary ?? '',
      event.description
    ].join(' ')
  );
  return terms.every((t) => hay.includes(t));
}

function details(event: FeedEvent): string {
  const parts: string[] = [];
  if (event.summary) parts.push(event.summary);
  else if (event.description) parts.push(event.description.slice(0, 600));
  if (event.orgs.length) parts.push(`Hosted by: ${event.orgs.join(', ')}`);
  if (event.ticketsUrl) parts.push(`Tickets: ${event.ticketsUrl}`);
  if (event.url) parts.push(`Details: ${event.url}`);
  parts.push('Subscribed via the BYU Campus Calendar.');
  return parts.join('\n\n');
}

function toVevent(event: FeedEvent): string[] {
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : new Date(start.getTime() + 3_600_000);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.id.replace(/[^\w:.-]/g, '-')}@byu-campus-calendar`,
    `DTSTAMP:${utcStamp(new Date())}`,
    event.allDay ? `DTSTART;VALUE=DATE:${dayStamp(start)}` : `DTSTART:${utcStamp(start)}`,
    event.allDay
      ? `DTEND;VALUE=DATE:${dayStamp(new Date(start.getTime() + 86_400_000))}`
      : `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(details(event))}`,
    `CATEGORIES:${escapeText(event.category)}`
  ];
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push('END:VEVENT');
  return lines.map(fold);
}

/** Human-readable calendar name, so the subscription is identifiable in a crowded sidebar. */
function calendarName(interests: string[], all: boolean): string {
  if (all || !interests.length) return 'BYU Campus Calendar';
  const labels = interests.map((i) => INTEREST_LABELS.get(i) ?? i);
  if (labels.length <= 3) return `BYU — ${labels.join(', ')}`;
  return `BYU — ${labels.slice(0, 2).join(', ')} +${labels.length - 2} more`;
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;

  const requested = (params.get('interests') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = requested.filter((id) => !KNOWN_INTERESTS.has(id));
  if (unknown.length) {
    // Returning an empty calendar for a typo'd interest would look like "nothing is scheduled",
    // which is a far more confusing failure than an error.
    return new Response(`Unknown interest id(s): ${unknown.join(', ')}`, {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  const showAll = params.get('all') === '1' || requested.length === 0;
  const orgs = new Set((params.get('orgs') ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  const query = params.get('q') ?? '';
  const freeOnly = params.get('free') === '1';

  const now = Date.now();
  const horizon = now + WINDOW_DAYS * 86_400_000;
  const followed = new Set(requested);

  const events = DATA.events.filter((e) => {
    const start = new Date(e.start).getTime();
    const end = e.end ? new Date(e.end).getTime() : start + 3_600_000;
    if (end < now || start > horizon) return false;
    if (freeOnly && !e.free) return false;
    if (orgs.size && !e.orgs.some((o) => orgs.has(o))) return false;
    if (!showAll && !e.interests.some((i) => followed.has(i))) return false;
    if (query && !matchesQuery(e, query)) return false;
    return true;
  });

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BYU Campus Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName(requested, showAll))}`,
    'X-WR-TIMEZONE:America/Denver',
    `X-WR-CALDESC:${escapeText(
      `${events.length} BYU events matching your interests. Snapshot generated ${DATA.generatedAt}.`
    )}`,
    // The snapshot refreshes once a day, so there is nothing to gain from a client polling hourly.
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    ...events.flatMap(toVevent),
    'END:VCALENDAR'
  ];

  return new Response(`${lines.join('\r\n')}\r\n`, {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="byu-campus-calendar.ics"',
      // Edge-cached for an hour: every subscriber with the same filters shares a response, and the
      // underlying snapshot only changes once a day.
      'cache-control': 'public, max-age=900, s-maxage=3600, stale-while-revalidate=86400',
      'access-control-allow-origin': '*'
    }
  });
}
