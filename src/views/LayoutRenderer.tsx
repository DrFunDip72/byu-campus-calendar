import { DiscoverView } from './DiscoverView';
import { FeedView } from './FeedView';
import { PlannerView } from './PlannerView';
import type { CampusEvent, LayoutId } from '../lib/types';

/**
 * Maps a layout id onto its component.
 *
 * This exists so the layout decision is made in exactly one place. App.tsx renders a layout inside
 * whichever placement chrome is active, and the compare view renders all three at once; without a
 * shared mapping those two would drift, and "Cards" would eventually mean different things in the
 * switcher and in the comparison.
 */
export function LayoutRenderer({
  layout,
  events,
  onOpen,
  saved,
  onSave
}: {
  layout: LayoutId;
  events: CampusEvent[];
  onOpen: (e: CampusEvent) => void;
  saved: string[];
  onSave: (id: string) => void;
}) {
  const props = { events, onOpen, saved, onSave };
  if (layout === 'list') return <FeedView {...props} />;
  if (layout === 'cards') return <DiscoverView {...props} />;
  return <PlannerView {...props} />;
}
