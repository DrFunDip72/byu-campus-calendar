import {
  CalendarDays,
  Globe,
  LayoutGrid,
  List,
  Monitor,
  Smartphone,
  type LucideIcon
} from 'lucide-react';
import type { LayoutId, PlacementId, ViewId } from './types';

/**
 * The surface registry, as two independent axes.
 *
 * The first cut of this project had one flat row of five tabs — BYU Website, BYU App, Feed,
 * Discover, Planner — and it could not be explained out loud. Two different questions were
 * collapsed into one control ("where would this live?" and "how are events laid out?"), and worse,
 * the BYU App surface had its *own* internal Feed/Discover/Month, so the word "Feed" meant two
 * different things depending on which tab you were in. A reviewer had to build a mental model of
 * five unrelated things before they could form an opinion about any of them.
 *
 * So the axes are now separate and named:
 *
 *   PLACEMENT — where this would live. Answers the pitch question.
 *   LAYOUT    — how events are arranged. Answers the student question.
 *
 * Every placement supports every layout, which is the part that makes it explainable:
 * "Same events, same filters. You pick where it lives and how it looks." No exceptions to
 * caveat, no tab that behaves unlike its neighbours.
 */

export interface PlacementDefinition {
  id: PlacementId;
  /** Short name for the switcher chip. */
  label: string;
  /** Full name used in the sheet, compare page and About panel. */
  title: string;
  blurb: string;
  /** Why this placement exists, for the Views sheet. */
  bestFor: string;
  icon: LucideIcon;
}

export interface LayoutDefinition {
  id: LayoutId;
  label: string;
  blurb: string;
  bestFor: string;
  icon: LucideIcon;
}

export const PLACEMENTS: PlacementDefinition[] = [
  {
    id: 'web',
    label: "BYU Website",
    title: "Today's BYU Website",
    blurb: "calendar.byu.edu's own chrome, with our search, filters and calendar sync added",
    bestFor: 'Showing leadership this fits the site they already run',
    icon: Globe
  },
  {
    id: 'app',
    label: 'BYU App',
    title: "Today's BYU App",
    blurb: "The BYU app's Calendar tab, rebuilt around interests",
    bestFor: 'Showing the same idea where students already are: their phone',
    icon: Smartphone
  },
  {
    id: 'standalone',
    label: 'Purpose-built',
    title: 'A purpose-built calendar',
    blurb: 'What we would build given a free hand, unconstrained by either existing product',
    bestFor: 'Seeing the idea at its best before deciding where to put it',
    icon: Monitor
  }
];

/**
 * Deliberately plain names. The previous set — Feed, Discover, Planner — were brand words a
 * student had to learn before they could say which one they preferred, and "Feed" collided with
 * the BYU App's internal mode of the same name. List / Cards / Month need no explanation.
 */
export const LAYOUTS: LayoutDefinition[] = [
  {
    id: 'list',
    label: 'List',
    blurb: 'Dense and scannable, grouped by day',
    bestFor: 'Answering “what’s on today?” fast — about 12 events per screen',
    icon: List
  },
  {
    id: 'cards',
    label: 'Cards',
    blurb: 'Image-led cards and rails for browsing',
    bestFor: 'Finding something you didn’t know you wanted',
    icon: LayoutGrid
  },
  {
    id: 'month',
    label: 'Month',
    blurb: 'A month grid with a day panel',
    bestFor: 'Seeing density and conflicts before committing',
    icon: CalendarDays
  }
];

export const PLACEMENT_IDS = PLACEMENTS.map((p) => p.id);
export const LAYOUT_IDS = LAYOUTS.map((l) => l.id);

export const placementById = (id: PlacementId): PlacementDefinition =>
  PLACEMENTS.find((p) => p.id === id) ?? PLACEMENTS[0];

export const layoutById = (id: LayoutId): LayoutDefinition =>
  LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];

export function isPlacement(value: unknown): value is PlacementId {
  return typeof value === 'string' && (PLACEMENT_IDS as string[]).includes(value);
}

export function isLayout(value: unknown): value is LayoutId {
  return typeof value === 'string' && (LAYOUT_IDS as string[]).includes(value);
}

/**
 * The five retired surface ids, each resolved to its cell in the new matrix.
 *
 * These still arrive from three places: links already shared publicly, `?design=` links older
 * still, and `view` values sitting in returning students' localStorage. All of them must land
 * somewhere sensible rather than silently resetting to the default.
 */
const LEGACY_VIEWS: Record<string, { placement: PlacementId; layout: LayoutId }> = {
  campus: { placement: 'web', layout: 'list' },
  web: { placement: 'web', layout: 'list' },
  app: { placement: 'app', layout: 'list' },
  feed: { placement: 'standalone', layout: 'list' },
  discover: { placement: 'standalone', layout: 'cards' },
  planner: { placement: 'standalone', layout: 'month' }
};

export function resolveLegacyView(
  value: string | null | undefined
): { placement: PlacementId; layout: LayoutId } | null {
  if (!value) return null;
  return LEGACY_VIEWS[value] ?? null;
}

/** Retained only so old saved preferences and shared links can still be interpreted. */
export type { ViewId };
