import type { CampusEvent, DateRangeId, Filters } from './types';
import { INTEREST_LABELS } from './data';

/**
 * Search and filtering, shared by all three designs. The designs differ only in how they *render*
 * a result set — the matching logic lives here once, so a student switching designs never sees a
 * different answer to the same query.
 */

/** "Football vs. Iowa State" -> "football vs iowa state", for accent- and punctuation-insensitive search. */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Everything a query can match. Built once per event and cached on first use: a student typing into
 * the search box re-filters 385 events on every keystroke, and rebuilding this string each time is
 * the one thing in the app that would actually feel slow.
 */
const haystacks = new WeakMap<CampusEvent, string>();

function haystack(event: CampusEvent): string {
  let value = haystacks.get(event);
  if (value === undefined) {
    value = normalize(
      [
        event.title,
        event.location ?? '',
        event.category,
        ...event.orgs,
        ...event.tags,
        // Interest *labels*, not ids, so typing "cross country" finds the events tagged track-xc.
        ...event.interests.map((i) => INTEREST_LABELS[i] ?? i),
        event.summary ?? '',
        event.description
      ].join(' ')
    );
    haystacks.set(event, value);
  }
  return value;
}

/** All terms must appear, in any order and any field. "football notre" finds Football vs. Notre Dame. */
export function matchesQuery(event: CampusEvent, query: string): boolean {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (!terms.length) return true;
  const hay = haystack(event);
  return terms.every((t) => hay.includes(t));
}

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Quick date ranges, resolved against a reference "now" so they stay testable.
 *
 * "This weekend" is Friday 5pm through end of Sunday, which is how a student means it — a Thursday
 * question about "this weekend" should return the coming Friday, not the previous one.
 */
export function resolveRange(range: DateRangeId, now = new Date()): DateRange | null {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const today = startOfDay(now);

  switch (range) {
    case 'today':
      return { from: today, to: addDays(today, 1) };
    case 'weekend': {
      const day = today.getDay(); // 0 Sun .. 6 Sat
      // Sunday still counts as "this weekend" until it ends; otherwise look forward to Friday.
      const toFriday = day === 0 ? -2 : (5 - day + 7) % 7;
      const friday = addDays(today, toFriday);
      const from = new Date(friday.getFullYear(), friday.getMonth(), friday.getDate(), 17, 0);
      return { from: day === 0 ? today : from, to: addDays(friday, 3) };
    }
    case 'week':
      return { from: today, to: addDays(today, 7) };
    case 'month':
      return { from: today, to: addDays(today, 30) };
    case 'all':
    default:
      return null;
  }
}

/**
 * An event is in range when it is still happening, not merely when it starts inside the window: a
 * 3-hour hackathon that began an hour ago is a thing a student can still walk into, so it belongs
 * in "Today". Events with no end time are treated as one hour long.
 */
function overlapsRange(event: CampusEvent, range: DateRange): boolean {
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : new Date(start.getTime() + 3_600_000);
  return end > range.from && start < range.to;
}

export interface FilterResult {
  events: CampusEvent[];
  /** Followed interests that matched nothing, so the UI can say so instead of silently showing less. */
  emptyInterests: string[];
}

export function applyFilters(all: CampusEvent[], filters: Filters, now = new Date()): FilterResult {
  const range = resolveRange(filters.range, now);
  const followed = new Set(filters.interests);
  const orgs = new Set(filters.orgs);
  const useInterests = filters.myFeedOnly && followed.size > 0;

  // Past events are never shown. The snapshot is refreshed daily, so it always contains some.
  const horizon = now.getTime() - 3_600_000;

  const events = all.filter((e) => {
    const start = new Date(e.start);
    const end = e.end ? new Date(e.end) : new Date(start.getTime() + 3_600_000);
    if (end.getTime() < horizon) return false;
    if (range && !overlapsRange(e, range)) return false;
    if (filters.freeOnly && !e.free) return false;
    if (orgs.size && !e.orgs.some((o) => orgs.has(o))) return false;
    if (useInterests && !e.interests.some((i) => followed.has(i))) return false;
    if (filters.query && !matchesQuery(e, filters.query)) return false;
    return true;
  });

  // Which followed interests produced nothing, ignoring the interest filter itself so this reports
  // "no upcoming Hackathons" rather than "no Hackathons among your other filters".
  const emptyInterests = useInterests
    ? filters.interests.filter(
        (id) =>
          !all.some((e) => {
            if (!e.interests.includes(id)) return false;
            const start = new Date(e.start);
            const end = e.end ? new Date(e.end) : new Date(start.getTime() + 3_600_000);
            return end.getTime() >= horizon;
          })
      )
    : [];

  return { events, emptyInterests };
}

/** Groups a sorted event list into calendar days, for the Feed and Planner views. */
export function groupByDay(events: CampusEvent[]): { key: string; date: Date; events: CampusEvent[] }[] {
  const out: { key: string; date: Date; events: CampusEvent[] }[] = [];
  let current: { key: string; date: Date; events: CampusEvent[] } | null = null;
  for (const e of events) {
    const date = new Date(e.start);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (!current || current.key !== key) {
      current = { key, date: new Date(date.getFullYear(), date.getMonth(), date.getDate()), events: [] };
      out.push(current);
    }
    current.events.push(e);
  }
  return out;
}
