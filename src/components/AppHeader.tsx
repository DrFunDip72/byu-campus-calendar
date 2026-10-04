import {
  Info,
  LayoutGrid,
  List,
  Rss,
  CalendarDays,
  SlidersHorizontal,
  GraduationCap
} from 'lucide-react';
import type { DesignId } from '../lib/types';
import { SearchInput } from './InterestPanel';

/**
 * The three designs are peers, not a default plus two experiments, so the switcher sits in the
 * header as a segmented control with all three always visible and labelled. The point of this build
 * is to let BYU leadership compare them side by side in one session — hiding two behind a menu
 * would defeat that.
 */
export const DESIGNS: { id: DesignId; label: string; icon: typeof List; blurb: string }[] = [
  {
    id: 'campus',
    label: 'BYU.edu',
    icon: GraduationCap,
    blurb: "calendar.byu.edu's own layout, carrying this data"
  },
  { id: 'feed', label: 'Feed', icon: List, blurb: 'A dense, scannable list grouped by day' },
  { id: 'discover', label: 'Discover', icon: LayoutGrid, blurb: 'Image-led cards for browsing' },
  { id: 'planner', label: 'Planner', icon: CalendarDays, blurb: 'A month grid for planning' }
];

interface Props {
  design: DesignId;
  setDesign: (d: DesignId) => void;
  query: string;
  setQuery: (q: string) => void;
  onOpenFilters: () => void;
  onOpenSubscribe: () => void;
  onOpenAbout: () => void;
  activeFilterCount: number;
}

export function AppHeader({
  design,
  setDesign,
  query,
  setQuery,
  onOpenFilters,
  onOpenSubscribe,
  onOpenAbout,
  activeFilterCount
}: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      {/* Navy bar: BYU's primary colour carries the wordmark, as it does on byu.edu. */}
      <div className="bg-navy text-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <a href="/" className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="font-serif text-lg font-semibold tracking-tight">BYU</span>
            <span className="text-sm font-medium text-navy-100">Campus Calendar</span>
          </a>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenSubscribe}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
            >
              <Rss className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Subscribe</span>
            </button>
            <button
              type="button"
              onClick={onOpenAbout}
              aria-label="About this project and its data sources"
              className="rounded-md p-1.5 text-navy-100 hover:bg-white/10 hover:text-white"
            >
              <Info className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-6">
        <nav
          aria-label="Choose a layout"
          className="flex shrink-0 rounded-lg border border-line bg-canvas p-0.5"
        >
          {DESIGNS.map((option) => {
            const Icon = option.icon;
            const on = design === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setDesign(option.id)}
                aria-current={on}
                title={option.blurb}
                className={`inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 sm:px-3 ${
                  on ? 'bg-white text-navy shadow-card' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {option.label}
              </button>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SearchInput value={query} onChange={setQuery} />
          {/* Filters live in a sheet below the lg breakpoint, where there is no room for a rail. */}
          <button
            type="button"
            onClick={onOpenFilters}
            className="relative inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-canvas lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-royal px-1 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
