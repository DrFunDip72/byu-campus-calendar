import { Rss, SlidersHorizontal } from 'lucide-react';
import { SearchInput } from './InterestPanel';

/**
 * Header for the three concept surfaces (Feed, Discover, Planner).
 *
 * It no longer carries the view switcher — that moved up into ViewSwitcher, which sits above every
 * surface including the two BYU recreations. This header is now just identity plus search, so the
 * BYU surfaces can render their own chrome underneath the switcher without competing with ours.
 */
interface Props {
  /** The current view's name, so the header says which concept you are looking at. */
  title: string;
  query: string;
  setQuery: (q: string) => void;
  onOpenFilters: () => void;
  onOpenSubscribe: () => void;
  activeFilterCount: number;
}

export function AppHeader({
  title,
  query,
  setQuery,
  onOpenFilters,
  onOpenSubscribe,
  activeFilterCount
}: Props) {
  return (
    <header className="sticky top-[34px] z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="bg-navy text-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <a href="/" className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 font-serif text-lg font-semibold tracking-tight">BYU</span>
            <span className="truncate text-sm font-medium text-navy-100">Campus Calendar</span>
            <span className="hidden text-xs text-navy-200 sm:inline">· {title}</span>
          </a>
          <button
            type="button"
            onClick={onOpenSubscribe}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
          >
            <Rss className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Subscribe</span>
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-4 py-2.5 sm:px-6">
        <SearchInput value={query} onChange={setQuery} />
        {/* Filters live in a sheet below lg, where there is no room for the rail. */}
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
    </header>
  );
}
