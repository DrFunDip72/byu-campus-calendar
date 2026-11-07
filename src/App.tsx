import { useCallback, useMemo, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { CalendarX2, Info, Plus, SlidersHorizontal, X } from 'lucide-react';
import { AppHeader } from './components/AppHeader';
import { AboutDialog } from './components/AboutDialog';
import { ByuFeatureBar, ByuFooter, ByuHeader } from './components/ByuChrome';
import { CompareDialog } from './components/CompareDialog';
import { EventDetail } from './components/EventDetail';
import { FeedbackBar, FeedbackLink } from './components/FeedbackBar';
import { SubscribeDialog } from './components/SubscribeDialog';
import { WelcomeCard, useWelcomeCard } from './components/WelcomeCard';
import { SurfaceSwitcher, ViewsSheet } from './components/SurfaceSwitcher';
import { ActiveFilterBar, InterestPanel } from './components/InterestPanel';
import { ByuAppView } from './views/ByuAppView';
import { CampusView } from './views/CampusView';
import { LayoutRenderer } from './views/LayoutRenderer';
import { applyFilters } from './lib/filters';
import { DATA, DEMO_COUNT, EVENTS, INTEREST_LABELS, REAL_COUNT } from './lib/data';
import { usePreferences } from './lib/prefs';
import { layoutById, placementById } from './lib/views';
import { trackCompareOpen, trackLayoutChange, trackPlacementChange } from './lib/analytics';
import { APP_MODE_FOR_LAYOUT } from './lib/types';
import type { CampusEvent, LayoutId, PlacementId } from './lib/types';

export default function App() {
  const {
    placement,
    setPlacement,
    layout,
    setLayout,
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

  // Wrapped so every switch is recorded once, wherever it was triggered from. The two axes are
  // tracked separately because they answer different questions — where this should live is the
  // pitch question, which layout students prefer is the design question — and a single combined
  // event would make neither answerable.
  const changePlacement = useCallback(
    (next: PlacementId, via: 'switcher' | 'sheet' | 'compare' = 'switcher') => {
      setPlacement(next);
      trackPlacementChange(next, via);
    },
    [setPlacement]
  );

  const changeLayout = useCallback(
    (next: LayoutId, via: 'switcher' | 'sheet' | 'compare' = 'switcher') => {
      setLayout(next);
      // Pinned day mode overrides the layout entirely on the BYU App placement. Clearing it here
      // rather than at one call site means the header, the mobile sheet and Compare all behave
      // the same; previously a `?mode=day` link left every one of them looking broken.
      setAppMode(null);
      trackLayoutChange(next, placement, via);
    },
    [setLayout, setAppMode, placement]
  );

  const [detail, setDetail] = useState<CampusEvent | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [feedbackSignal, setFeedbackSignal] = useState(0);
  const { welcomeOpen, closeWelcome } = useWelcomeCard();
  const openFeedback = useCallback(() => {
    closeWelcome();
    setFeedbackSignal((n) => n + 1);
  }, [closeWelcome]);
  /** BYU Website placement only: which BYU category the nav has drilled into. */
  const [webCategory, setWebCategory] = useState<string | null>(null);

  // Recomputed on every filter or query change. The snapshot is small enough that filtering on
  // each keystroke is imperceptible, so there is no debounce — results move as the student types.
  const { events, emptyInterests } = useMemo(() => applyFilters(EVENTS, filters), [filters]);

  const activeFilterCount =
    (filters.myFeedOnly ? filters.interests.length : 0) +
    filters.orgs.length +
    (filters.range !== 'all' ? 1 : 0) +
    (filters.freeOnly ? 1 : 0);

  const openCompare = useCallback(
    (from: string) => {
      trackCompareOpen(from);
      setCompareOpen(true);
    },
    []
  );

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

  /**
   * The honesty banner.
   *
   * Shown on every placement rather than tucked inside the About panel, because the stand-in
   * events are visible on the first screen and a label that has to be hunted for is not a label.
   * It also doubles as the pitch: the reason stand-ins are needed at all *is* the finding.
   */
  const demoBanner = DEMO_COUNT > 0 && (
    <div className="border-b border-amber-200 bg-amber-50">
      <p className="mx-auto flex max-w-[1200px] items-start gap-2 px-4 py-2 text-[11px] leading-snug text-amber-900 sm:px-6 sm:text-xs">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">{REAL_COUNT} real BYU events</span> pulled from the public
          calendar API, plus <span className="font-semibold">{DEMO_COUNT} stand-ins marked DEMO</span>{' '}
          — because that feed has no category for clubs, hackathons or any specific student
          association.{' '}
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="font-semibold underline hover:no-underline"
          >
            Why that matters
          </button>
        </span>
      </p>
    </div>
  );

  const emptyNotice = emptyInterests.length > 0 && (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      Nothing scheduled for{' '}
      <span className="font-semibold">
        {emptyInterests.map((id) => INTEREST_LABELS[id] ?? id).join(', ')}
      </span>{' '}
      in the next {Math.round(DATA.windowDays / 30)} months from the sources we pull.{' '}
      <button
        type="button"
        onClick={() => setAboutOpen(true)}
        className="font-semibold underline hover:no-underline"
      >
        See coverage
      </button>
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

  /** Rendered on every placement, so both axes and the dialogs are always reachable. */
  const shell = (
    <SurfaceSwitcher
      placement={placement}
      layout={layout}
      onPlacementChange={changePlacement}
      onLayoutChange={changeLayout}
      onOpenFilters={() => setFiltersOpen(true)}
      onOpenSubscribe={() => setSubscribeOpen(true)}
      onOpenAbout={() => setAboutOpen(true)}
      onOpenViews={() => setViewsOpen(true)}
      onOpenCompare={() => openCompare('switcher')}
      activeFilterCount={activeFilterCount}
      // The whole snapshot, not the filtered result. The sentence's claim is that all nine
      // combinations share one dataset; wiring it to the filter count made it read "Same 10 events
      // and filters in all nine" the moment anyone narrowed anything.
      eventCount={EVENTS.length}
    />
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
        placement={placement}
        layout={layout}
        events={events}
      />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <ViewsSheet
        open={viewsOpen}
        placement={placement}
        layout={layout}
        onPlacementChange={(next) => changePlacement(next, 'sheet')}
        onLayoutChange={(next) => changeLayout(next, 'sheet')}
        onOpenCompare={() => openCompare('sheet')}
        onClose={() => setViewsOpen(false)}
      />
      <CompareDialog
        open={compareOpen}
        events={events}
        current={layout}
        onPick={(next) => changeLayout(next, 'compare')}
        onVote={(next) => trackLayoutChange(next, placement, 'compare')}
        onClose={() => setCompareOpen(false)}
      />
      {/* The BYU App placement renders filters inside the phone frame instead — a drawer sliding
          out of the browser's right edge next to a phone mock is not the interaction being
          proposed. See ByuAppView. */}
      {filtersOpen && placement !== 'app' && (
        <FilterSheet onClose={() => setFiltersOpen(false)} count={events.length}>
          {panel}
        </FilterSheet>
      )}
      {/* The arrival card and the floating button are a pair: the card's only job beyond saying
          what this is, is to hand off to the button, which is why the button is raised above the
          card's own scrim while it is open. Order matters — the card renders after the button so
          it wins on equal stacking, and `lifted` is what puts the button back on top. */}
      <FeedbackBar
        placement={placement}
        layout={layout}
        openSignal={feedbackSignal}
        lifted={welcomeOpen}
        onOpen={closeWelcome}
      />
      <WelcomeCard open={welcomeOpen} onClose={closeWelcome} onGiveFeedback={openFeedback} />
      {/* No install banner. BYU already ships a mobile app, so "add this to your home screen"
          competes with the thing this proposal is trying to improve rather than supporting it. The
          manifest and offline service worker stay — they cost nothing and make a flaky-signal
          campus load faster — but nothing prompts for installation. */}
      {/* Vercel Web Analytics: page views, visitors, referrers. Cookie-free, so no consent banner. */}
      <Analytics />
    </>
  );

  // ---------------------------------------------------------------------------
  // BYU Website — their chrome, our features, any of the three layouts.
  // ---------------------------------------------------------------------------
  if (placement === 'web') {
    return (
      <div className="flex min-h-screen flex-col bg-white font-sans text-byu-charcoal">
        {shell}
        {demoBanner}
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
          ) : layout === 'list' ? (
            // The faithful recreation of calendar.byu.edu's own list is BYU's List layout. Swapping
            // it for our generic one here would throw away the "this is your site today" evidence.
            <CampusView
              events={events}
              onOpen={setDetail}
              saved={saved}
              onSave={toggleSaved}
              activeCategory={webCategory}
              onSelectCategory={setWebCategory}
            />
          ) : (
            <LayoutRenderer
              layout={layout}
              events={events}
              onOpen={setDetail}
              saved={saved}
              onSave={toggleSaved}
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
  if (placement === 'app') {
    return (
      <div className="flex min-h-screen flex-col bg-app-bg font-sans">
        {shell}
        {demoBanner}
        <main className="flex flex-1 flex-col items-center px-0 py-0 sm:px-4 sm:py-6">
          {/* On a wide screen the app renders inside a phone frame with a caption, because a
              full-bleed "mobile app" on a projector reads as a website. */}
          <div className="hidden w-full max-w-[420px] pb-3 text-center sm:block">
            <p className="text-xs text-white/50">
              The BYU app’s Calendar tab, rebuilt around interests. Today’s app shows one day at a
              time — <span className="text-white/70">{layoutById(layout).label}</span> is the
              proposal.
            </p>
          </div>
          <ByuAppView
            events={events}
            onOpen={setDetail}
            saved={saved}
            onSave={toggleSaved}
            // `appMode` is only ever set by the `?mode=day` pitch escape hatch; normally the global
            // layout drives the app's internal mode so the two axes stay honest.
            mode={appMode ?? APP_MODE_FOR_LAYOUT[layout]}
            onSelectLayout={(next) => changeLayout(next, 'switcher')}
            onOpenFilters={() => setFiltersOpen(true)}
            filtersOpen={filtersOpen}
            onCloseFilters={() => setFiltersOpen(false)}
            filterPanel={panel}
            resultCount={events.length}
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
  // Purpose-built — our own chrome with a persistent filter rail. The default.
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      {shell}
      {demoBanner}
      <AppHeader
        title={placementById(placement).title}
        subtitle={layoutById(layout).blurb}
        query={filters.query}
        setQuery={(query) => patch({ query })}
        onOpenFilters={() => setFiltersOpen(true)}
        onOpenSubscribe={() => setSubscribeOpen(true)}
        activeFilterCount={activeFilterCount}
      />

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-4 sm:px-6">
        <aside className="hidden w-[268px] shrink-0 lg:block">
          <div className="sticky top-[150px] max-h-[calc(100vh-170px)] overflow-y-auto pb-6 pr-1">
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
          ) : (
            <LayoutRenderer
              layout={layout}
              events={events}
              onOpen={setDetail}
              saved={saved}
              onSave={toggleSaved}
            />
          )}
        </main>
      </div>

      {dialogs}

      <button
        type="button"
        onClick={() => setSubscribeOpen(true)}
        className="fixed bottom-20 right-4 z-30 inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-3 text-sm font-semibold text-white shadow-lift hover:bg-navy-600 sm:hidden"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Sync calendar
      </button>

      <footer className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-36 pt-4 text-xs text-muted sm:px-6 sm:pb-28">
        <span>A student-built proposal. Event data from BYU, linking back to the official pages.</span>
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className="font-medium text-royal hover:underline"
        >
          Sources and coverage
        </button>
        <FeedbackLink onClick={() => setFeedbackSignal((n) => n + 1)} />
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
