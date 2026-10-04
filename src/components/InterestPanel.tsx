import { Check, RotateCcw, Search, X } from 'lucide-react';
import { INTEREST_COUNTS, INTEREST_GROUPS, INTEREST_LABELS, ORGS } from '../lib/data';
import type { DateRangeId, Filters } from '../lib/types';

const RANGES: { id: DateRangeId; label: string }[] = [
  { id: 'all', label: 'Anytime' },
  { id: 'today', label: 'Today' },
  { id: 'weekend', label: 'Weekend' },
  { id: 'week', label: 'Next 7 days' },
  { id: 'month', label: 'Next 30 days' }
];

interface Props {
  filters: Filters;
  patch: (changes: Partial<Filters>) => void;
  toggleInterest: (id: string) => void;
  toggleOrg: (name: string) => void;
  clearFilters: () => void;
  resultCount: number;
}

/**
 * The preference surface. Everything a student sets lives here, in one place, and it is the same
 * component in all three designs — swapping the layout should not mean relearning the controls.
 *
 * Interests are grouped and show live counts, which does two jobs: it tells a student what is worth
 * following, and it makes the coverage gaps honest. "Hackathons (0)" is true and useful; silently
 * omitting the chip would hide that no connected source publishes hackathons yet.
 */
export function InterestPanel({
  filters,
  patch,
  toggleInterest,
  toggleOrg,
  clearFilters,
  resultCount
}: Props) {
  const anyFilter =
    filters.query !== '' || filters.orgs.length > 0 || filters.range !== 'all' || filters.freeOnly;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">My interests</h2>
          {filters.interests.length > 0 && (
            <button
              type="button"
              onClick={() => patch({ interests: [] })}
              className="text-xs font-medium text-royal hover:underline"
            >
              Clear all
            </button>
          )}
        </div>

        {/*
          The one switch that decides what the feed *is*. Default is "My interests only" with an
          empty interest list, which means a new visitor sees everything — the app is useful before
          it is configured, and gets more useful as they pick.
        */}
        <label className="mb-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-canvas p-3">
          <input
            type="checkbox"
            checked={filters.myFeedOnly}
            onChange={(e) => patch({ myFeedOnly: e.target.checked })}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-navy-200 text-navy focus:ring-navy"
          />
          <span className="text-sm leading-snug">
            <span className="font-medium text-ink">Only show my interests</span>
            <span className="block text-xs text-muted">
              {filters.interests.length === 0
                ? 'Nothing followed yet, so everything is showing.'
                : `Following ${filters.interests.length} ${
                    filters.interests.length === 1 ? 'interest' : 'interests'
                  }.`}
            </span>
          </span>
        </label>

        <div className="flex flex-col gap-4">
          {INTEREST_GROUPS.map((group) => (
            <div key={group.id}>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-navy-400">
                {group.label}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {group.interests.map((interest) => {
                  const on = filters.interests.includes(interest.id);
                  const count = INTEREST_COUNTS[interest.id] ?? 0;
                  return (
                    <button
                      key={interest.id}
                      type="button"
                      onClick={() => toggleInterest(interest.id)}
                      aria-pressed={on}
                      title={count === 0 ? 'No upcoming events from connected sources' : undefined}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                        on
                          ? 'border-navy bg-navy text-white'
                          : count === 0
                            ? 'border-line bg-white text-muted/60 hover:border-navy-200'
                            : 'border-line bg-white text-ink hover:border-navy-300 hover:bg-navy-50'
                      }`}
                    >
                      {on && <Check className="h-3 w-3" aria-hidden />}
                      {interest.label}
                      <span className={on ? 'text-navy-200' : 'text-muted'}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">When</h2>
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((range) => (
            <button
              key={range.id}
              type="button"
              onClick={() => patch({ range: range.id })}
              aria-pressed={filters.range === range.id}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                filters.range === range.id
                  ? 'border-royal bg-royal text-white'
                  : 'border-line bg-white text-ink hover:border-royal-300'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Hosting organization
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {ORGS.map((org) => {
            const on = filters.orgs.includes(org.name);
            return (
              <button
                key={org.name}
                type="button"
                onClick={() => toggleOrg(org.name)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors duration-150 ${
                  on ? 'border-navy bg-navy text-white' : 'border-line bg-white text-ink hover:border-navy-300'
                }`}
              >
                {org.name}
                <span className={on ? 'text-navy-200' : 'text-muted'}>{org.count}</span>
              </button>
            );
          })}
        </div>
        {/*
          Only seven organizations resolve from a 270-day pull, because the BYU calendar's DeptNames
          field is mostly empty or set to a publishing bucket. Saying so is better than letting a
          reviewer assume this is every club on campus.
        */}
        <p className="mt-2 text-[11px] leading-snug text-muted">
          Only {ORGS.length} organizations publish a host name to the BYU calendar API. Club-level
          hosts need the sources listed in the About panel.
        </p>
      </section>

      <section>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={filters.freeOnly}
            onChange={(e) => patch({ freeOnly: e.target.checked })}
            className="h-4 w-4 rounded border-navy-200 text-navy focus:ring-navy"
          />
          <span className="text-sm text-ink">Free events only</span>
        </label>
      </section>

      {anyFilter && (
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-canvas"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reset search and dates
        </button>
      )}

      <p className="text-xs text-muted">
        {resultCount} {resultCount === 1 ? 'event' : 'events'} match.
      </p>
    </div>
  );
}

/** The active-filter summary shown above the results in every design. */
export function ActiveFilterBar({
  filters,
  patch,
  toggleInterest,
  toggleOrg
}: Pick<Props, 'filters' | 'patch' | 'toggleInterest' | 'toggleOrg'>) {
  const chips: { key: string; label: string; clear: () => void }[] = [];

  if (filters.query) {
    chips.push({
      key: 'q',
      label: `"${filters.query}"`,
      clear: () => patch({ query: '' })
    });
  }
  if (filters.myFeedOnly) {
    for (const id of filters.interests) {
      chips.push({ key: `i:${id}`, label: INTEREST_LABELS[id] ?? id, clear: () => toggleInterest(id) });
    }
  }
  for (const org of filters.orgs) {
    chips.push({ key: `o:${org}`, label: org, clear: () => toggleOrg(org) });
  }
  if (filters.range !== 'all') {
    const label = RANGES.find((r) => r.id === filters.range)?.label ?? filters.range;
    chips.push({ key: 'range', label, clear: () => patch({ range: 'all' }) });
  }
  if (filters.freeOnly) {
    chips.push({ key: 'free', label: 'Free only', clear: () => patch({ freeOnly: false }) });
  }

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted">Showing:</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.clear}
          className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-700 hover:bg-navy-100"
        >
          {chip.label}
          <X className="h-3 w-3" aria-hidden />
        </button>
      ))}
    </div>
  );
}

/** Search input, shared by the header and the mobile filter sheet. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search events, teams, clubs, places…'
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search events"
        className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-8 text-sm text-ink placeholder:text-muted focus:border-royal focus:outline-none focus:ring-1 focus:ring-royal"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:bg-canvas hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
