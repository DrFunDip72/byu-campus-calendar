import { useMemo, useState } from 'react';
import { CalendarX2, Plus, SlidersHorizontal, X } from 'lucide-react';
import { AppHeader } from './components/AppHeader';
import { AboutDialog } from './components/AboutDialog';
import { EventDetail } from './components/EventDetail';
import { SubscribeDialog } from './components/SubscribeDialog';
import { ActiveFilterBar, InterestPanel } from './components/InterestPanel';
import { FeedView } from './views/FeedView';
import { DiscoverView } from './views/DiscoverView';
import { PlannerView } from './views/PlannerView';
import { applyFilters } from './lib/filters';
import { EVENTS, INTEREST_LABELS } from './lib/data';
import { usePreferences } from './lib/prefs';
import type { CampusEvent } from './lib/types';

export default function App() {
  const { design, setDesign, filters, patch, toggleInterest, toggleOrg, clearFilters, saved, toggleSaved } =
    usePreferences();

  const [detail, setDetail] = useState<CampusEvent | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Recomputed on every filter or query change. 385 events is small enough that filtering on each
  // keystroke is imperceptible, so there is no debounce — the results move as the student types.
  const { events, emptyInterests } = useMemo(() => applyFilters(EVENTS, filters), [filters]);

  const activeFilterCount =
    (filters.myFeedOnly ? filters.interests.length : 0) +
    filters.orgs.length +
    (filters.range !== 'all' ? 1 : 0) +
    (filters.freeOnly ? 1 : 0);

  const panel = (
    <InterestPanel
      filters={filters}
      patch={patch}
      toggleInterest={toggleInterest}
      toggleOrg={toggleOrg}
      clearFilters={clearFilters}
      resultCount={events.length}
    />
  );

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <AppHeader
        design={design}
        setDesign={setDesign}
        query={filters.query}
        setQuery={(query) => patch({ query })}
        onOpenFilters={() => setFiltersOpen(true)}
        onOpenSubscribe={() => setSubscribeOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
        activeFilterCount={activeFilterCount}
      />

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-4 sm:px-6">
        {/* Desktop filter rail. Below lg it becomes the sheet opened from the header. */}
        <aside className="hidden w-[268px] shrink-0 lg:block">
          <div className="sticky top-[112px] max-h-[calc(100vh-128px)] overflow-y-auto pb-6 pr-1">
            {panel}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-3 flex flex-col gap-2">
            <ActiveFilterBar
              filters={filters}
              patch={patch}
              toggleInterest={toggleInterest}
              toggleOrg={toggleOrg}
            />
            {/*
              A followed interest with no upcoming events is called out explicitly. Silently showing
              fewer results would read as a broken filter; this reads as a coverage fact.
            */}
            {emptyInterests.length > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Nothing scheduled for{' '}
                <span className="font-semibold">
                  {emptyInterests.map((id) => INTEREST_LABELS[id] ?? id).join(', ')}
                </span>{' '}
                in the next {Math.round(270 / 30)} months from the sources we pull. Club-run events
                are not connected yet —{' '}
                <button
                  type="button"
                  onClick={() => setAboutOpen(true)}
                  className="font-semibold underline hover:no-underline"
                >
                  see coverage
                </button>
                .
              </p>
            )}
          </div>

          {events.length === 0 ? (
            <EmptyState
              hasFilters={activeFilterCount > 0 || filters.query !== ''}
              onClear={() => {
                clearFilters();
                patch({ interests: [], query: '' });
              }}
            />
          ) : design === 'feed' ? (
            <FeedView events={events} onOpen={setDetail} saved={saved} onSave={toggleSaved} />
          ) : design === 'discover' ? (
            <DiscoverView events={events} onOpen={setDetail} saved={saved} onSave={toggleSaved} />
          ) : (
            <PlannerView events={events} onOpen={setDetail} saved={saved} onSave={toggleSaved} />
          )}
        </main>
      </div>

      {/* Mobile filter sheet */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setFiltersOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className="relative ml-auto flex h-full w-full max-w-sm flex-col bg-white"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="inline-flex items-center gap-2 font-serif text-lg text-ink">
                <SlidersHorizontal className="h-4 w-4 text-navy-400" aria-hidden />
                Filters
              </h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
                className="rounded-full p-2 text-muted hover:bg-canvas hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{panel}</div>
            <div className="border-t border-line p-3">
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-600"
              >
                Show {events.length} {events.length === 1 ? 'event' : 'events'}
              </button>
            </div>
          </div>
        </div>
      )}

      <EventDetail
        event={detail}
        onClose={() => setDetail(null)}
        saved={detail ? saved.includes(detail.id) : false}
        onSave={() => detail && toggleSaved(detail.id)}
      />

      <SubscribeDialog
        open={subscribeOpen}
        onClose={() => setSubscribeOpen(false)}
        filters={filters}
        design={design}
        events={events}
      />

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />

      {/* Mobile subscribe affordance: the header button is cramped on a phone, and subscribing is
          the action worth one persistent piece of screen real estate. */}
      <button
        type="button"
        onClick={() => setSubscribeOpen(true)}
        className="fixed bottom-5 right-4 z-30 inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-3 text-sm font-semibold text-white shadow-lift hover:bg-navy-600 sm:hidden"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Sync calendar
      </button>

      <footer className="mx-auto max-w-[1400px] px-4 pb-24 pt-4 text-xs text-muted sm:px-6 sm:pb-8">
        A student-built proposal. Event data from BYU, linking back to the official pages.{' '}
        <button type="button" onClick={() => setAboutOpen(true)} className="font-medium text-royal hover:underline">
          Sources and coverage
        </button>
      </footer>
    </div>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-white px-6 py-16 text-center">
      <CalendarX2 className="h-8 w-8 text-navy-200" aria-hidden />
      <h2 className="font-serif text-xl text-ink">No events match</h2>
      <p className="max-w-sm text-sm text-muted">
        {hasFilters
          ? 'Try widening the date range, removing an interest, or searching for something broader.'
          : 'The calendar snapshot has no upcoming events. It refreshes daily.'}
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="mt-1 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-600"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
