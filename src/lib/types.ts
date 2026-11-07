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
  /**
   * True for illustrative stand-ins, which are badged DEMO everywhere they render.
   *
   * These exist because BYU's public feed has no vocabulary for most of what a student actually
   * wants to follow — there is no club field, no hackathon category, nothing for a specific
   * student association. Without a handful of stand-ins the headline feature (granular interest
   * filtering) has almost nothing to filter on, and the demo undersells the idea. Without the
   * badge, the demo would overstate the data. So: present, and labelled.
   */
  demo?: boolean;
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
  /** How many events in this snapshot are illustrative stand-ins rather than real BYU records. */
  demoCount?: number;
  sources: { id: string; label: string; url: string; count: number }[];
  /** The interest catalog, emitted by the ingest so the UI cannot drift from the classifier. */
  groups: InterestGroup[];
  orgs: string[];
  interestCounts: Record<string, number>;
  events: CampusEvent[];
}

/**
 * Navigation is two independent axes, not one flat list. See lib/views.ts for why.
 *
 *   PLACEMENT — where this would live
 *       web         recreation of calendar.byu.edu, their chrome
 *       app         recreation of the BYU mobile app's Calendar tab, in a phone frame
 *       standalone  a purpose-built calendar, unconstrained by either
 *
 *   LAYOUT — how events are arranged. Every layout works in every placement.
 *       list · cards · month
 *
 * The retired single-axis ids (`web`, `app`, `feed`, `discover`, `planner`, plus the original
 * `campus`) are still accepted from URLs and saved preferences and mapped onto a cell of the
 * matrix. See LEGACY_VIEWS in lib/views.ts.
 */
export type PlacementId = 'web' | 'app' | 'standalone';

export type LayoutId = 'list' | 'cards' | 'month';

/** The retired flat surface ids. Read-only: accepted as input, never written. */
export type ViewId = 'web' | 'app' | 'feed' | 'discover' | 'planner';

/**
 * Layouts available inside the BYU App recreation.
 *
 * `day` is the authentic one — today's BYU app genuinely shows a single day at a time, which is
 * the gap the proposal is built around. It is not offered as a global layout (it would be an
 * exception that only exists in one placement, which is what we just finished removing) but stays
 * reachable at `?mode=day` so the before/after can be demonstrated side by side in a pitch.
 */
export type AppMode = 'day' | 'feed' | 'discover' | 'month';

/** Maps a global layout onto the BYU App recreation's internal mode. */
export const APP_MODE_FOR_LAYOUT: Record<LayoutId, AppMode> = {
  list: 'feed',
  cards: 'discover',
  month: 'month'
};

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
