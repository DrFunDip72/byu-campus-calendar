import { useCallback, useEffect, useRef, useState } from 'react';
import type { DesignId, Filters } from './types';
import { EMPTY_FILTERS } from './types';

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

interface StoredPrefs {
  interests: string[];
  myFeedOnly: boolean;
  design: DesignId;
  saved: string[];
}

const DEFAULTS: StoredPrefs = {
  interests: [],
  myFeedOnly: true,
  design: 'feed',
  saved: []
};

function readStorage(): StoredPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<StoredPrefs>;
    return {
      interests: Array.isArray(parsed.interests) ? parsed.interests.filter((x) => typeof x === 'string') : [],
      myFeedOnly: typeof parsed.myFeedOnly === 'boolean' ? parsed.myFeedOnly : true,
      design: parsed.design === 'discover' || parsed.design === 'planner' ? parsed.design : 'feed',
      saved: Array.isArray(parsed.saved) ? parsed.saved.filter((x) => typeof x === 'string') : []
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

export function designFromUrl(): DesignId | null {
  const value = new URLSearchParams(window.location.search).get('design');
  return value === 'feed' || value === 'discover' || value === 'planner' ? value : null;
}

/** Serializes filters into a query string, omitting anything at its default. */
export function filtersToQuery(filters: Filters, design?: DesignId): string {
  const params = new URLSearchParams();
  if (design) params.set('design', design);
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

  const [design, setDesign] = useState<DesignId>(() => designFromUrl() ?? initial.current!.design);

  const [filters, setFilters] = useState<Filters>(() => {
    const fromUrl = filtersFromUrl();
    return {
      ...EMPTY_FILTERS,
      interests: initial.current!.interests,
      myFeedOnly: initial.current!.myFeedOnly,
      ...(fromUrl ?? {})
    };
  });

  const [saved, setSaved] = useState<string[]>(() => initial.current!.saved);

  // Persist the durable bits. `query` and `range` are deliberately not persisted: a search box that
  // still holds last week's query on a fresh visit feels broken.
  useEffect(() => {
    writeStorage({ interests: filters.interests, myFeedOnly: filters.myFeedOnly, design, saved });
  }, [filters.interests, filters.myFeedOnly, design, saved]);

  // Keep the address bar in sync so the current view is always copy-pasteable. replaceState rather
  // than pushState: filter tweaks should not fill up the back button.
  useEffect(() => {
    const query = filtersToQuery(filters, design);
    const next = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState(null, '', next);
  }, [filters, design]);

  const toggleInterest = useCallback((id: string) => {
    setFilters((f) => ({
      ...f,
      interests: f.interests.includes(id) ? f.interests.filter((x) => x !== id) : [...f.interests, id]
    }));
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
    design,
    setDesign,
    filters,
    patch,
    toggleInterest,
    toggleOrg,
    clearFilters,
    saved,
    toggleSaved
  };
}
