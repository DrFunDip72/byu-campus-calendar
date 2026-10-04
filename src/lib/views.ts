import { CalendarDays, Globe, LayoutGrid, List, Smartphone, type LucideIcon } from 'lucide-react';
import type { ViewId } from './types';

/**
 * The single registry of surfaces: ids, names, grouping and one-line descriptions.
 *
 * Everything that names a view — the desktop switcher, the mobile Views sheet, the About panel,
 * the smoke test — reads from here, so a view cannot be renamed in one place and stale in another.
 *
 * The naming is the point. "Design 1 / Design 2" told a reviewer nothing; these names say what each
 * surface *is* and, through the group, why it exists.
 */

export interface ViewDefinition {
  id: ViewId;
  /** Short name for the switcher chip. */
  label: string;
  /** Full name used in the Views sheet and About panel. */
  title: string;
  blurb: string;
  /** What this layout is best at, for the Views sheet. */
  bestFor: string;
  icon: LucideIcon;
  group: ViewGroupId;
}

export type ViewGroupId = 'byu' | 'concept';

export const VIEW_GROUPS: { id: ViewGroupId; label: string; caption: string }[] = [
  {
    id: 'byu',
    label: "Inside BYU's products",
    caption: 'The same data and features, wearing BYU’s existing design.'
  },
  {
    id: 'concept',
    label: 'Our concepts',
    caption: 'What a purpose-built campus calendar could be.'
  }
];

export const VIEWS: ViewDefinition[] = [
  {
    id: 'web',
    label: 'BYU Website',
    title: 'BYU Website',
    blurb: "calendar.byu.edu's layout, with our search, filters and calendar sync added",
    bestFor: 'Showing leadership this fits the site they already run',
    icon: Globe,
    group: 'byu'
  },
  {
    id: 'app',
    label: 'BYU App',
    title: 'BYU App',
    blurb: "The BYU app's Calendar tab, rebuilt around interests — with four layouts inside it",
    bestFor: 'Showing the same idea where students actually are: their phone',
    icon: Smartphone,
    group: 'byu'
  },
  {
    id: 'feed',
    label: 'Feed',
    title: 'Feed',
    blurb: 'A dense, scannable list grouped by day',
    bestFor: 'Answering “what’s on today?” fast — about 12 events per screen',
    icon: List,
    group: 'concept'
  },
  {
    id: 'discover',
    label: 'Discover',
    title: 'Discover',
    blurb: 'Image-led cards and rails for browsing',
    bestFor: 'Finding something you didn’t know you wanted',
    icon: LayoutGrid,
    group: 'concept'
  },
  {
    id: 'planner',
    label: 'Planner',
    title: 'Planner',
    blurb: 'A month grid with a day panel',
    bestFor: 'Seeing density and conflicts before committing',
    icon: CalendarDays,
    group: 'concept'
  }
];

export const VIEW_IDS = VIEWS.map((v) => v.id);

/** Older ids that still appear in shared links and saved preferences. */
export const VIEW_ALIASES: Record<string, ViewId> = { campus: 'web' };

export function resolveView(value: string | null | undefined): ViewId | null {
  if (!value) return null;
  if ((VIEW_IDS as string[]).includes(value)) return value as ViewId;
  return VIEW_ALIASES[value] ?? null;
}

export const viewById = (id: ViewId): ViewDefinition =>
  VIEWS.find((v) => v.id === id) ?? VIEWS[0];

export const viewsInGroup = (group: ViewGroupId) => VIEWS.filter((v) => v.group === group);
