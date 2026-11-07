import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppMode, Filters, LayoutId, PlacementId } from './types';
import { EMPTY_FILTERS } from './types';
import { isLayout, isPlacement, resolveLegacyView } from './views';
import { trackFollowInterest } from './analytics';

/**
 * Preferences live in two places on purpose:
 *
 *   - localStorage, so a student sets their interests once and the feed is theirs on every visit.
 *     There is no login, which is deliberate for a pitch: nobody evaluating this should have to
 *     make an account, and the real version would read interests from a BYU sign-in instead.
 *   - the URL, so a filtered view is shareable ("here's the link to all the dance events") and so
 *     the ICS subscription endpoint can be handed the exact same filter set.
 *
 * The URL wins on load when it carries filters, because an explicit shared link should override
 * whatever the recipient had saved.
 */

const STORAGE_KEY = 'byu-campus-calendar.v1';

const APP_MODES: AppMode[] = ['day', 'feed', 'discover', 'month'];

interface StoredPrefs {
  interests: string[];
  myFeedOnly: boolean;
  placement: PlacementId;
  layout: LayoutId;
  /** Only ever non-default via the `?mode=day` pitch escape hatch. See types.ts. */
  appMode: AppMode | null;
  saved: string[];
}

/**
 * The purpose-built calendar is the default, not the BYU Website recreation.
 *
 * The first version opened on the BYU Website skin, which meant the first thing a student saw was
 * a faithful copy of the page they already find inadequate — the proposal's own improvements were
 * a tab away. Leading with the purpose-built surface shows the idea at full strength; the BYU
 * skins are then the answer to "but would it fit?", which is a pitch question, not a student one.
 */
const DEFAULTS: StoredPrefs = {
  interests: [],
  myFeedOnly: true,
  placement: 'standalone',
  layout: 'list',
  appMode: null,
  saved: []
};

function readStorage(): StoredPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // A preference saved before the two-axis rewrite holds a single `view` id. Map it onto a cell
    // of the matrix rather than resetting, so a returning student lands where they left off.
    const legacy = resolveLegacyView(parsed.view as string);

    return {
      interests: Array.isArray(parsed.interests)
        ? (parsed.interests as unknown[]).filter((x): x is string => typeof x === 'string')
        : [],
      myFeedOnly: typeof parsed.myFeedOnly === 'boolean' ? parsed.myFeedOnly : true,
      placement: isPlacement(parsed.placement)
        ? parsed.placement
        : (legacy?.placement ?? DEFAULTS.placement),
      layout: isLayout(parsed.layout) ? parsed.layout : (legacy?.layout ?? DEFAULTS.layout),
      // Deliberately NOT restored. `appMode` is a pitch escape hatch for showing today's day-only
      // BYU app, not a preference — and while it is set it overrides the layout axis entirely.
      // The previous build defaulted it to 'day' and persisted it, so anyone who used the app
      // surface before the rewrite came back with day mode pinned and both layout switchers dead.
      // It now comes from the URL or not at all.
      appMode: null,
      saved: Array.isArray(parsed.saved)
        ? (parsed.saved as unknown[]).filter((x): x is string => typeof x === 'string')
        : []
    };
  } catch {
    // Private-browsing mode and a corrupt value both land here; defaults are the right answer.
    return DEFAULTS;
  }
}

function writeStorage(prefs: StoredPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable: preferences simply do not persist this session */
  }
}

/** Reads filters out of the query string. Returns null when the URL carries none. */
function filtersFromUrl(): Partial<Filters> | null {
  const params = new URLSearchParams(window.location.search);
  const out: Partial<Filters> = {};
  let found = false;
  const interests = params.get('interests');
  if (interests) {
    out.interests = interests.split(',').filter(Boolean);
    out.myFeedOnly = true;
    found = true;
  }
  const orgs = params.get('orgs');
  if (orgs) {
    out.orgs = orgs.split(',').filter(Boolean);
    found = true;
  }
  const q = params.get('q');
  if (q) {
    out.query = q;
    found = true;
  }
  const range = params.get('range');
  if (range && ['today', 'weekend', 'week', 'month', 'all'].includes(range)) {
    out.range = range as Filters['range'];
    found = true;
  }
  if (params.get('free') === '1') {
    out.freeOnly = true;
    found = true;
  }
  if (params.get('all') === '1') {
    out.myFeedOnly = false;
    found = true;
  }
  return found ? out : null;
}

/**
 * `?placement=` and `?layout=` are canonical.
 *
 * `?view=` and the older `?design=` carried the retired flat surface ids and are still honoured,
 * because links using them have already been shared publicly. An explicit `?placement=` or
 * `?layout=` beats the legacy pair when both appear.
 */
export function surfaceFromUrl(): { placement: PlacementId | null; layout: LayoutId | null } {
  const params = new URLSearchParams(window.location.search);
  const legacy = resolveLegacyView(params.get('view')) ?? resolveLegacyView(params.get('design'));
  const placement = params.get('placement');
  const layout = params.get('layout');
  return {
    placement: isPlacement(placement) ? placement : (legacy?.placement ?? null),
    layout: isLayout(layout) ? layout : (legacy?.layout ?? null)
  };
}

/** The `?mode=day` escape hatch that keeps today's day-only BYU app demonstrable. */
export function appModeFromUrl(): AppMode | null {
  const value = new URLSearchParams(window.location.search).get('mode') as AppMode | null;
  return value && APP_MODES.includes(value) ? value : null;
}

/** Serializes filters into a query string, omitting anything at its default. */
export function filtersToQuery(
  filters: Filters,
  placement?: PlacementId,
  layout?: LayoutId,
  appMode?: AppMode | null
): string {
  const params = new URLSearchParams();
  if (placement) params.set('placement', placement);
  if (layout) params.set('layout', layout);
  // Only meaningful on the App placement, and only when deliberately pinned.
  if (placement === 'app' && appMode) params.set('mode', appMode);
  if (filters.interests.length) params.set('interests', filters.interests.join(','));
  if (filters.orgs.length) params.set('orgs', filters.orgs.join(','));
  if (filters.query) params.set('q', filters.query);
  if (filters.range !== 'all') params.set('range', filters.range);
  if (filters.freeOnly) params.set('free', '1');
  if (!filters.myFeedOnly) params.set('all', '1');
  return params.toString();
}

export function usePreferences() {
  const initial = useRef<StoredPrefs>();
  if (!initial.current) initial.current = readStorage();

  const fromUrl = useRef<ReturnType<typeof surfaceFromUrl>>();
  if (!fromUrl.current) fromUrl.current = surfaceFromUrl();

  const [placement, setPlacement] = useState<PlacementId>(
    () => fromUrl.current!.placement ?? initial.current!.placement
  );
  const [layout, setLayout] = useState<LayoutId>(
    () => fromUrl.current!.layout ?? initial.current!.layout
  );
  const [appMode, setAppMode] = useState<AppMode | null>(
    () => appModeFromUrl() ?? initial.current!.appMode
  );

  const [filters, setFilters] = useState<Filters>(() => {
    const urlFilters = filtersFromUrl();
    return {
      ...EMPTY_FILTERS,
      interests: initial.current!.interests,
      myFeedOnly: initial.current!.myFeedOnly,
      ...(urlFilters ?? {})
    };
  });

  const [saved, setSaved] = useState<string[]>(() => initial.current!.saved);

  // Persist the durable bits. `query` and `range` are deliberately not persisted: a search box that
  // still holds last week's query on a fresh visit feels broken.
  useEffect(() => {
    writeStorage({
      interests: filters.interests,
      myFeedOnly: filters.myFeedOnly,
      placement,
      layout,
      appMode,
      saved
    });
  }, [filters.interests, filters.myFeedOnly, placement, layout, appMode, saved]);

  // Keep the address bar in sync so the current view is always copy-pasteable. replaceState rather
  // than pushState: filter tweaks should not fill up the back button.
  useEffect(() => {
    const query = filtersToQuery(filters, placement, layout, appMode);
    const next = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState(null, '', next);
  }, [filters, placement, layout, appMode]);

  const toggleInterest = useCallback((id: string) => {
    setFilters((f) => {
      const following = f.interests.includes(id);
      // Only follows are reported, not unfollows: the question worth answering is which interests
      // students want, and counting both halves of a toggle would just add noise.
      if (!following) trackFollowInterest(id);
      return {
        ...f,
        interests: following ? f.interests.filter((x) => x !== id) : [...f.interests, id]
      };
    });
  }, []);

  const toggleOrg = useCallback((name: string) => {
    setFilters((f) => ({
      ...f,
      orgs: f.orgs.includes(name) ? f.orgs.filter((x) => x !== name) : [...f.orgs, name]
    }));
  }, []);

  const toggleSaved = useCallback((id: string) => {
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);

  const patch = useCallback((changes: Partial<Filters>) => setFilters((f) => ({ ...f, ...changes })), []);

  const clearFilters = useCallback(
    () => setFilters((f) => ({ ...EMPTY_FILTERS, interests: f.interests, myFeedOnly: f.myFeedOnly })),
    []
  );

  return {
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
  };
}
