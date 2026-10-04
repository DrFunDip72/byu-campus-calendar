import { useMemo, useState } from 'react';
import { CalendarX2, Info, Plus, Rss, SlidersHorizontal, X } from 'lucide-react';
import { AppHeader, DESIGNS } from './components/AppHeader';
import { AboutDialog } from './components/AboutDialog';
import { ByuFooter, ByuHeader } from './components/ByuChrome';
import { EventDetail } from './components/EventDetail';
import { SubscribeDialog } from './components/SubscribeDialog';
import { ActiveFilterBar, InterestPanel } from './components/InterestPanel';
import { CampusView } from './views/CampusView';
import { FeedView } from './views/FeedView';
import { DiscoverView } from './views/DiscoverView';
import { PlannerView } from './views/PlannerView';
import { applyFilters } from './lib/filters';
import { DATA, EVENTS, INTEREST_LABELS } from './lib/data';
import { usePreferences } from './lib/prefs';
import type { CampusEvent, DesignId } from './lib/types';

export default function App() {
  const { design, setDesign, filters, patch, toggleInterest, toggleOrg, clearFilters, saved, toggleSaved } =
    usePreferences();

  const [detail, setDetail] = useState<CampusEvent | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  /** Campus design only: which BYU category the nav has drilled into. */
  const [campusCategory, setCampusCategory] = useState<string | null>(null);

  // Recomputed on every filter or query change. The snapshot is small enough that filtering on
  // each keystroke is imperceptible, so there is no debounce — results move as the student types.
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

  const emptyNotice = emptyInterests.length > 0 && (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      Nothing scheduled for{' '}
      <span className="font-semibold">
        {emptyInterests.map((id) => INTEREST_LABELS[id] ?? id).join(', ')}
      </span>{' '}
      in the next {Math.round(DATA.windowDays / 30)} months from the sources we pull. Club-run events
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
  );

  const dialogs = (
    <>
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
      {filtersOpen && (
        <FilterSheet
          onClose={() => setFiltersOpen(false)}
          count={events.length}
          alwaysAvailable={design === 'campus'}
        >
          {panel}
        </FilterSheet>
      )}
    </>
  );

  // ---------------------------------------------------------------------------
  // Campus design: BYU's own chrome, so leadership sees this on their site.
  // The design switcher moves into a slim strip above the BYU header, visually separated and
  // labelled, so the page below it can be a faithful recreation rather than a hybrid.
  // ---------------------------------------------------------------------------
  if (design === 'campus') {
    return (
      <div className="flex min-h-screen flex-col bg-white font-sans text-byu-charcoal">
        <PrototypeBar
          design={design}
          setDesign={setDesign}
          onOpenFilters={() => setFiltersOpen(true)}
          onOpenSubscribe={() => setSubscribeOpen(true)}
          onOpenAbout={() => setAboutOpen(true)}
          activeFilterCount={activeFilterCount}
        />

        <ByuHeader
          activeCategory={campusCategory}
          onSelectCategory={setCampusCategory}
          query={filters.query}
          onQueryChange={(query) => patch({ query })}
        />

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6">
          {(activeFilterCount > 0 || filters.query) && (
            <div className="mb-4 flex flex-col gap-2">
              <ActiveFilterBar
                filters={filters}
                patch={patch}
                toggleInterest={toggleInterest}
                toggleOrg={toggleOrg}
              />
              {emptyNotice}
            </div>
          )}

          {events.length === 0 ? (
            <EmptyState
              hasFilters={activeFilterCount > 0 || filters.query !== ''}
              onClear={() => {
                clearFilters();
                patch({ interests: [], query: '' });
              }}
            />
          ) : (
            <CampusView
              events={events}
              onOpen={setDetail}
              saved={saved}
              onSave={toggleSaved}
              activeCategory={campusCategory}
              onSelectCategory={setCampusCategory}
            />
          )}
        </main>

        <ByuFooter />
        {dialogs}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // The three original designs share our own chrome and a persistent filter rail.
  // ---------------------------------------------------------------------------
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
            {emptyNotice}
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

      {dialogs}

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

/**
 * The strip above the BYU header in the Campus design.
 *
 * Deliberately styled *unlike* BYU — near-black, small, dense — so nobody mistakes it for part of
 * the page being proposed. It says in one line that the chrome below is a recreation, which is the
 * honest framing for showing leadership a mock of their own site.
 */
function PrototypeBar({
  design,
  setDesign,
  onOpenFilters,
  onOpenSubscribe,
  onOpenAbout,
  activeFilterCount
}: {
  design: DesignId;
  setDesign: (d: DesignId) => void;
  onOpenFilters: () => void;
  onOpenSubscribe: () => void;
  onOpenAbout: () => void;
  activeFilterCount: number;
}) {
  return (
    <div className="sticky top-0 z-40 bg-byu-black text-white">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-1.5 sm:px-6">
        <span className="hidden text-[10px] font-bold uppercase tracking-[0.1em] text-white/50 sm:inline">
          Prototype
        </span>

        <nav aria-label="Choose a layout" className="flex items-center gap-0.5">
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
                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold transition-colors ${
                  on ? 'bg-white text-byu-black' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-3 w-3" aria-hidden />
                {option.label}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenFilters}
            className="relative inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
          >
            <SlidersHorizontal className="h-3 w-3" aria-hidden />
            My interests
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-byu-red px-1 text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onOpenSubscribe}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
          >
            <Rss className="h-3 w-3" aria-hidden />
            Subscribe
          </button>
          <button
            type="button"
            onClick={onOpenAbout}
            aria-label="About this prototype and its data sources"
            className="p-1 text-white/70 hover:text-white"
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterSheet({
  onClose,
  count,
  alwaysAvailable,
  children
}: {
  onClose: () => void;
  count: number;
  /** The Campus design has no filter rail at any width, so its sheet is not breakpoint-limited. */
  alwaysAvailable: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`fixed inset-0 z-50 flex ${alwaysAvailable ? '' : 'lg:hidden'}`}>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className="relative ml-auto flex h-full w-full max-w-sm flex-col bg-white"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="inline-flex items-center gap-2 font-serif text-lg text-ink">
            <SlidersHorizontal className="h-4 w-4 text-navy-400" aria-hidden />
            My interests
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="rounded-full p-2 text-muted hover:bg-canvas hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-ink">{children}</div>
        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-600"
          >
            Show {count} {count === 1 ? 'event' : 'events'}
          </button>
        </div>
      </div>
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
