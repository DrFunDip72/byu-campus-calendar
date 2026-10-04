import { Menu, Plus, Rss, Search, X } from 'lucide-react';
import type { DateRangeId, Filters } from '../lib/types';
import { INTEREST_COUNTS, INTEREST_LABELS } from '../lib/data';

/**
 * A recreation of the calendar.byu.edu site chrome, for the Campus design.
 *
 * Everything here is matched to the real site rather than invented:
 *   - Header: navy bar carrying the BYU wordmark, then a white strip with the site title and the
 *     "Submit an Event" / Search actions, then a category nav row.
 *   - Footer: the four real column groups (Contact Us, Resources, Related Links, Connect) with the
 *     actual link text, and the real legal line.
 *   - Type: IBM Plex Sans, which is what the site loads from Google Fonts.
 *
 * The nav categories are BYU's nine main calendar categories, in the order the site lists them.
 */

const NAV_CATEGORIES = [
  'Devotionals & Forums',
  'Arts & Entertainment',
  'Athletics',
  'Student Life',
  'Education',
  'Health & Wellness',
  'Conferences',
  'Other'
];

interface HeaderProps {
  /** The active category filter, or null for the home view. */
  activeCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  query: string;
  onQueryChange: (q: string) => void;
}

export function ByuHeader({ activeCategory, onSelectCategory, query, onQueryChange }: HeaderProps) {
  return (
    <div className="border-b border-byu-rule bg-white font-sans">
      {/* Navy wordmark bar. The real site uses the BYU monogram at max 55px wide. */}
      <div className="bg-byu-navy">
        <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 py-2.5 sm:px-6">
          <a href="/" className="flex items-center" aria-label="Brigham Young University">
            <span className="font-sans text-[22px] font-bold leading-none tracking-[0.02em] text-white">
              BYU
            </span>
          </a>
          <span className="h-5 w-px bg-white/30" aria-hidden />
          <a href="/" className="text-[15px] font-normal leading-none text-white hover:underline">
            Events Calendar
          </a>
          <div className="ml-auto flex items-center gap-1.5">
            <a
              href="https://calendar.byu.edu/submit-an-event-form"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden border border-white/40 px-3 py-1.5 text-[13px] font-semibold uppercase tracking-[0.05em] text-white hover:bg-white/10 sm:block"
            >
              Submit an Event
            </a>
            <span className="p-1.5 text-white/80" aria-hidden>
              <Search className="h-4 w-4" />
            </span>
            <span className="border border-white/40 p-1.5 text-white/80 lg:hidden" aria-hidden>
              <Menu className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      {/* Search strip. The real site puts search behind an icon; a campus calendar prototype is
          more useful with the field always open, and it keeps parity with the other designs. */}
      <div className="border-b border-byu-rule bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-2.5 sm:px-6">
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-byu-slate"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search events"
              aria-label="Search events"
              className="w-full border border-byu-ruleDark py-1.5 pl-8 pr-8 text-sm text-byu-charcoal placeholder:text-byu-slate focus:border-byu-link focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-byu-slate hover:text-byu-charcoal"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category nav. Horizontally scrollable on small screens rather than collapsed into a
          hamburger, so the categories stay visible — they are the primary navigation here. */}
      <nav aria-label="Event categories" className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <ul className="flex gap-0 overflow-x-auto">
          <li>
            <button
              type="button"
              onClick={() => onSelectCategory(null)}
              aria-current={activeCategory === null}
              className={`whitespace-nowrap border-b-[3px] px-3 py-2.5 text-[13px] font-semibold uppercase tracking-[0.05em] transition-colors ${
                activeCategory === null
                  ? 'border-byu-navy text-byu-navy'
                  : 'border-transparent text-byu-slate hover:text-byu-navy'
              }`}
            >
              Home
            </button>
          </li>
          {NAV_CATEGORIES.map((category) => (
            <li key={category}>
              <button
                type="button"
                onClick={() => onSelectCategory(category)}
                aria-current={activeCategory === category}
                className={`whitespace-nowrap border-b-[3px] px-3 py-2.5 text-[13px] font-semibold uppercase tracking-[0.05em] transition-colors ${
                  activeCategory === category
                    ? 'border-byu-navy text-byu-navy'
                    : 'border-transparent text-byu-slate hover:text-byu-navy'
                }`}
              >
                {category}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/**
 * The feature bar that the real calendar.byu.edu does not have.
 *
 * This is the "keep BYU's styling but add our features" answer: everything here is drawn in BYU's
 * own design language — square corners, navy and link-blue, uppercase lead-in labels, IBM Plex —
 * so it looks like a section BYU built, not a widget bolted on.
 *
 * It surfaces the three things the real site makes impossible: filtering by what you actually care
 * about, narrowing to a timeframe, and subscribing so the answer keeps arriving.
 */
export function ByuFeatureBar({
  filters,
  patch,
  toggleInterest,
  onOpenFilters,
  onOpenSubscribe,
  resultCount
}: {
  filters: Filters;
  patch: (changes: Partial<Filters>) => void;
  toggleInterest: (id: string) => void;
  onOpenFilters: () => void;
  onOpenSubscribe: () => void;
  resultCount: number;
}) {
  // Followed interests first, then the biggest remaining ones, so the bar is immediately useful
  // before a student has configured anything and personal once they have.
  const followed = filters.myFeedOnly ? filters.interests : [];
  const suggestions = Object.entries(INTEREST_COUNTS)
    .filter(([id, count]) => count > 0 && !followed.includes(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  return (
    <section className="border-b border-byu-rule bg-byu-grey">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-byu-navy">
            Show me
          </span>
          <div className="flex flex-wrap gap-1.5">
            {RANGE_OPTIONS.map((range) => (
              <button
                key={range.id}
                type="button"
                onClick={() => patch({ range: range.id })}
                aria-pressed={filters.range === range.id}
                className={`border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                  filters.range === range.id
                    ? 'border-byu-navy bg-byu-navy text-white'
                    : 'border-byu-ruleDark bg-white text-byu-charcoal hover:border-byu-navy'
                }`}
              >
                {range.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => patch({ freeOnly: !filters.freeOnly })}
              aria-pressed={filters.freeOnly}
              className={`border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                filters.freeOnly
                  ? 'border-byu-navy bg-byu-navy text-white'
                  : 'border-byu-ruleDark bg-white text-byu-charcoal hover:border-byu-navy'
              }`}
            >
              Free only
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[12px] text-byu-slate sm:inline">
              {resultCount} {resultCount === 1 ? 'event' : 'events'}
            </span>
            <button
              type="button"
              onClick={onOpenSubscribe}
              className="inline-flex items-center gap-1.5 border border-byu-link bg-byu-link px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.05em] text-white transition-colors hover:bg-white hover:text-byu-link"
            >
              <Rss className="h-3.5 w-3.5" aria-hidden />
              Subscribe
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-byu-navy">
            My interests
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {followed.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleInterest(id)}
                className="inline-flex items-center gap-1 border border-byu-navy bg-byu-navy px-2.5 py-1 text-[12px] font-semibold text-white"
              >
                {INTEREST_LABELS[id] ?? id}
                <X className="h-3 w-3" aria-hidden />
              </button>
            ))}
            {suggestions.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleInterest(id)}
                className="inline-flex items-center gap-1 border border-byu-ruleDark bg-white px-2.5 py-1 text-[12px] text-byu-charcoal transition-colors hover:border-byu-link hover:text-byu-link"
              >
                <Plus className="h-3 w-3" aria-hidden />
                {INTEREST_LABELS[id] ?? id}
                <span className="text-byu-slate">{INTEREST_COUNTS[id]}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={onOpenFilters}
              className="px-2 py-1 text-[12px] font-semibold text-byu-link underline-offset-2 hover:underline"
            >
              All interests &amp; organizations →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

const RANGE_OPTIONS: { id: DateRangeId; label: string }[] = [
  { id: 'all', label: 'Anytime' },
  { id: 'today', label: 'Today' },
  { id: 'weekend', label: 'This weekend' },
  { id: 'week', label: 'Next 7 days' },
  { id: 'month', label: 'Next 30 days' }
];

const FOOTER_COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: 'Contact Us',
    links: [
      { label: 'University Communications', href: 'https://brandguide.byu.edu' },
      { label: '801-422-4511', href: 'tel:8014224511' },
      { label: 'Calendar API', href: 'https://calendar.byu.edu/byu-calendar-api-documentation' }
    ]
  },
  {
    heading: 'Resources',
    links: [
      { label: 'BYU Photo', href: 'https://photo.byu.edu' },
      { label: 'Campus Maps', href: 'https://map.byu.edu' },
      { label: 'Directions to BYU', href: 'https://www.byu.edu/directions' }
    ]
  },
  {
    heading: 'Related Links',
    links: [
      { label: 'BYU Arts', href: 'https://arts.byu.edu' },
      { label: 'BYU Athletics', href: 'https://byucougars.com' },
      { label: 'BYU News', href: 'https://news.byu.edu' },
      { label: 'BYUSA', href: 'https://byusa.byu.edu' },
      { label: 'BYUtv', href: 'https://www.byutv.org' }
    ]
  }
];

export function ByuFooter() {
  return (
    <footer className="mt-10 bg-byu-navy font-sans text-white">
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.08em] text-white">
                {column.heading}
              </h2>
              <ul className="flex flex-col gap-1.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] text-byu-sky hover:text-white hover:underline"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.08em] text-white">
              About This Prototype
            </h2>
            {/*
              The one place the recreation deliberately breaks character. A pitch mock that looks
              exactly like the real site needs to say somewhere that it is not the real site.
            */}
            <p className="text-[13px] leading-relaxed text-byu-sky">
              A student-built proposal, not an official BYU page. Event data comes from BYU&apos;s own
              public calendar API and links back to the official listings.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/20">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-4 text-[11px] uppercase tracking-[0.06em] text-byu-sky sm:flex-row sm:items-center sm:gap-4 sm:px-6">
          <span>Provo, UT 84602, USA</span>
          <span>801-422-4636</span>
          <span className="sm:ml-auto">© {new Date().getFullYear()} All Rights Reserved</span>
        </div>
      </div>
    </footer>
  );
}
