export interface CampusEvent {
  id: string;
  title: string;
  /** ISO 8601 with the correct America/Denver offset baked in at ingest. */
  start: string;
  end: string | null;
  allDay: boolean;
  location: string | null;
  /** One of the nine BYU Calendar categories. */
  category: string;
  /** BYU's own tags (e.g. "BYUSA", "Homecoming"). Sparse. */
  tags: string[];
  /** Hosting organizations, noise buckets removed. May be empty. */
  orgs: string[];
  /** Our derived student-facing interest ids. Always at least one. */
  interests: string[];
  description: string;
  summary: string | null;
  image: string | null;
  imageAlt: string | null;
  url: string | null;
  ticketsUrl: string | null;
  free: boolean;
  priceLow: number;
  priceHigh: number;
  /** Source id, or several joined with "+" when sources were merged. */
  source: string;
}

export interface InterestGroup {
  id: string;
  label: string;
  /** Sorted by live event count, so the panel leads with what is actually happening. */
  interests: { id: string; label: string }[];
}

export interface EventSnapshot {
  generatedAt: string;
  windowDays: number;
  sources: { id: string; label: string; url: string; count: number }[];
  /** The interest catalog, emitted by the ingest so the UI cannot drift from the classifier. */
  groups: InterestGroup[];
  orgs: string[];
  interestCounts: Record<string, number>;
  events: CampusEvent[];
}

/**
 * The five surfaces, in two families.
 *
 *   BYU surfaces  — what this proposal looks like inside BYU's *existing* products, so the pitch
 *                   conversation can be about the idea rather than about whether it would fit.
 *       web       recreation of calendar.byu.edu
 *       app       recreation of the BYU mobile app's Calendar tab
 *
 *   Concepts      — what we would build given a free hand.
 *       feed · discover · planner
 *
 * `campus` was the original id for `web` and is still accepted from URLs so older links keep
 * working. See VIEW_ALIASES in lib/views.ts.
 */
export type ViewId = 'web' | 'app' | 'feed' | 'discover' | 'planner';

/** Layouts available *inside* the BYU App surface. Deliberately excludes the website recreation. */
export type AppMode = 'day' | 'feed' | 'discover' | 'month';

export type DateRangeId = 'today' | 'weekend' | 'week' | 'month' | 'all';

export interface Filters {
  query: string;
  /** Followed interest ids. Empty = no interest filter (show everything). */
  interests: string[];
  /** When true, only followed interests appear. When false, everything shows. */
  myFeedOnly: boolean;
  orgs: string[];
  range: DateRangeId;
  freeOnly: boolean;
}

export const EMPTY_FILTERS: Filters = {
  query: '',
  interests: [],
  myFeedOnly: true,
  orgs: [],
  range: 'all',
  freeOnly: false
};
