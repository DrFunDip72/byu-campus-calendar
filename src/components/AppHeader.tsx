import { Rss, SlidersHorizontal } from 'lucide-react';
import { SearchInput } from './InterestPanel';

/**
 * Header for the purpose-built placement.
 *
 * It does not carry the surface switcher — that lives in SurfaceSwitcher, which sits above every
 * placement including the two BYU recreations. This header is identity plus search, so the BYU
 * placements can render their own chrome underneath the switcher without competing with ours.
 */
interface Props {
  /** The placement's name. */
  title: string;
  /** What the current layout is good at, so the header names both axes. */
  subtitle?: string;
  query: string;
  setQuery: (q: string) => void;
  onOpenFilters: () => void;
  onOpenSubscribe: () => void;
  activeFilterCount: number;
}

export function AppHeader({
  title,
  subtitle,
  query,
  setQuery,
  onOpenFilters,
  onOpenSubscribe,
  activeFilterCount
}: Props) {
  return (
    // The sm: top offset clears the two-row surface switcher pinned above it. Below sm the
    // switcher collapses to a single row and the sheet replaces it, so no offset is needed.
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur sm:top-[62px]">
      <div className="bg-navy text-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <a href="/" className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 font-serif text-lg font-semibold tracking-tight">BYU</span>
            <span className="truncate text-sm font-medium text-navy-100">Campus Calendar</span>
            <span className="hidden text-xs text-navy-200 sm:inline">· {title}</span>
            {subtitle && (
              <span className="hidden truncate text-xs text-navy-300 lg:inline">· {subtitle}</span>
            )}
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
