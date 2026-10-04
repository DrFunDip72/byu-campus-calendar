import { useCallback, useMemo, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { CalendarX2, Plus, SlidersHorizontal, X } from 'lucide-react';
import { AppHeader } from './components/AppHeader';
import { AboutDialog } from './components/AboutDialog';
import { ByuFeatureBar, ByuFooter, ByuHeader } from './components/ByuChrome';
import { EventDetail } from './components/EventDetail';
import { InstallPrompt } from './components/InstallPrompt';
import { SubscribeDialog } from './components/SubscribeDialog';
import { ViewSwitcher, ViewsSheet } from './components/ViewSwitcher';
import { ActiveFilterBar, InterestPanel } from './components/InterestPanel';
import { ByuAppView } from './views/ByuAppView';
import { CampusView } from './views/CampusView';
import { FeedView } from './views/FeedView';
import { DiscoverView } from './views/DiscoverView';
import { PlannerView } from './views/PlannerView';
import { applyFilters } from './lib/filters';
import { DATA, EVENTS, INTEREST_LABELS } from './lib/data';
import { usePreferences } from './lib/prefs';
import { viewById } from './lib/views';
import { trackViewChange } from './lib/analytics';
import type { CampusEvent, ViewId } from './lib/types';

export default function App() {
  const {
    view,
    setView,
    appMode,
    setAppMode,
    filters,
    patch,
    toggleInterest,
    toggleOrg,
    clearFilters,
    saved,
    toggleSaved
  } = usePreferences();

  // Wrapped so every surface switch is recorded once, wherever it was triggered from. Which of
  // the five surfaces people actually use is the single most useful number this project can report.
  const changeView = useCallback(
    (next: ViewId, via: 'switcher' | 'sheet' = 'switcher') => {
      setView(next);
      trackViewChange(next, via);
    },
    [setView]
  );

  const [detail, setDetail] = useState<CampusEvent | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  /** BYU Website surface only: which BYU category the nav has drilled into. */
  const [webCategory, setWebCategory] = useState<string | null>(null);

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

  const emptyState = (
    <EmptyState
      hasFilters={activeFilterCount > 0 || filters.query !== ''}
      onClear={() => {
        clearFilters();
        patch({ interests: [], query: '' });
      }}
    />
  );

  /** Rendered on every surface, so the switcher, filters and dialogs are always reachable. */
  const shell = (
    <>
      <ViewSwitcher
        view={view}
        onViewChange={changeView}
        onOpenFilters={() => setFiltersOpen(true)}
        onOpenSubscribe={() => setSubscribeOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
        onOpenViews={() => setViewsOpen(true)}
        activeFilterCount={activeFilterCount}
      />
    </>
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
        view={view}
        events={events}
      />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <ViewsSheet
        open={viewsOpen}
        current={view}
        onSelect={(next) => changeView(next, 'sheet')}
        onClose={() => setViewsOpen(false)}
      />
      {filtersOpen && (
        <FilterSheet onClose={() => setFiltersOpen(false)} count={events.length}>
          {panel}
        </FilterSheet>
      )}
      <InstallPrompt />
      {/* Vercel Web Analytics: page views, visitors, referrers. Cookie-free, so no consent banner. */}
      <Analytics />
    </>
  );

  // ---------------------------------------------------------------------------
  // BYU Website — their chrome, our features.
  // ---------------------------------------------------------------------------
  if (view === 'web') {
    return (
      <div className="flex min-h-screen flex-col bg-white font-sans text-byu-charcoal">
        {shell}
        <ByuHeader
          activeCategory={webCategory}
          onSelectCategory={setWebCategory}
          query={filters.query}
          onQueryChange={(query) => patch({ query })}
        />
        <ByuFeatureBar
          filters={filters}
          patch={patch}
          toggleInterest={toggleInterest}
          onOpenFilters={() => setFiltersOpen(true)}
          onOpenSubscribe={() => setSubscribeOpen(true)}
          resultCount={events.length}
        />

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6">
          {emptyNotice && <div className="mb-4">{emptyNotice}</div>}
          {events.length === 0 ? (
            emptyState
          ) : (
            <CampusView
              events={events}
              onOpen={setDetail}
              saved={saved}
              onSave={toggleSaved}
              activeCategory={webCategory}
              onSelectCategory={setWebCategory}
            />
          )}
        </main>

        <ByuFooter />
        {dialogs}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // BYU App — their mobile Calendar tab, rebuilt around interests.
  // ---------------------------------------------------------------------------
  if (view === 'app') {
    return (
      <div className="flex min-h-screen flex-col bg-app-bg font-sans">
        {shell}
        <main className="flex flex-1 flex-col items-center px-0 py-0 sm:px-4 sm:py-6">
          {/* On a wide screen the app renders inside a phone frame with a caption, because a
              full-bleed "mobile app" on a projector reads as a website. */}
          <div className="hidden w-full max-w-[420px] pb-3 text-center sm:block">
            <p className="text-xs text-white/50">
              The BYU app’s Calendar tab, rebuilt. Four layouts, interest filters, one-tap calendar
              add.
            </p>
          </div>
          <ByuAppView
            events={events}
            onOpen={setDetail}
            saved={saved}
            onSave={toggleSaved}
            mode={appMode}
            onModeChange={setAppMode}
            onOpenFilters={() => setFiltersOpen(true)}
            query={filters.query}
            onQueryChange={(query) => patch({ query })}
            activeFilterCount={activeFilterCount}
          />
          {emptyNotice && <div className="w-full max-w-[420px] px-3 pt-3">{emptyNotice}</div>}
        </main>
        {dialogs}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Our concepts — shared chrome with a persistent filter rail.
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      {shell}
      <AppHeader
        title={viewById(view).title}
        query={filters.query}
        setQuery={(query) => patch({ query })}
        onOpenFilters={() => setFiltersOpen(true)}
        onOpenSubscribe={() => setSubscribeOpen(true)}
        activeFilterCount={activeFilterCount}
      />

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-4 sm:px-6">
        <aside className="hidden w-[268px] shrink-0 lg:block">
          <div className="sticky top-[120px] max-h-[calc(100vh-140px)] overflow-y-auto pb-6 pr-1">
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
            emptyState
          ) : view === 'feed' ? (
            <FeedView events={events} onOpen={setDetail} saved={saved} onSave={toggleSaved} />
          ) : view === 'discover' ? (
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

function FilterSheet({
  onClose,
  count,
  children
}: {
  onClose: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[55] flex">
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
