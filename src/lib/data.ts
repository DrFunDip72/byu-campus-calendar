import snapshot from '../data/events.json';
import type { CampusEvent, EventSnapshot } from './types';

export const DATA = snapshot as unknown as EventSnapshot;

export const EVENTS: CampusEvent[] = DATA.events;

export const INTEREST_GROUPS = DATA.groups;

/** id -> label, for rendering a chip from an event's interest ids. */
export const INTEREST_LABELS: Record<string, string> = Object.fromEntries(
  DATA.groups.flatMap((g) => g.interests.map((i) => [i.id, i.label]))
);

/** id -> group id, used to colour-code chips by family. */
export const INTEREST_GROUP_OF: Record<string, string> = Object.fromEntries(
  DATA.groups.flatMap((g) => g.interests.map((i) => [i.id, g.id]))
);

export const INTEREST_COUNTS = DATA.interestCounts;

/** Organizations that actually host something in the window, with counts. */
export const ORGS: { name: string; count: number }[] = (() => {
  const counts = new Map<string, number>();
  for (const e of EVENTS) for (const o of e.orgs) counts.set(o, (counts.get(o) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
})();

export const CATEGORY_ACCENT: Record<string, string> = {
  Athletics: 'athletics',
  'Arts & Entertainment': 'arts',
  'Student Life': 'student',
  Education: 'education',
  'Devotionals & Forums': 'devotional',
  'Health & Wellness': 'wellness',
  Conferences: 'conference',
  'Major Conferences': 'conference',
  Other: 'other'
};

export const accentFor = (event: CampusEvent) => CATEGORY_ACCENT[event.category] ?? 'other';
