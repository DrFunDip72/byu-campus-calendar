import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Filter,
  Home,
  LayoutGrid,
  List,
  type LucideIcon,
  MapPin,
  Menu,
  Rows3,
  Search,
  CalendarDays as CalendarIcon
} from 'lucide-react';
import type { AppMode, CampusEvent } from '../lib/types';
import { accentFor, INTEREST_LABELS } from '../lib/data';
import { dayKey, formatPrice, formatTimeRange, relativeDayLabel } from '../lib/format';
import { groupByDay } from '../lib/filters';
import { googleCalendarUrl } from '../lib/calendar';

interface Props {
  events: CampusEvent[];
  onOpen: (e: CampusEvent) => void;
  saved: string[];
  onSave: (id: string) => void;
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onOpenFilters: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  activeFilterCount: number;
}

/**
 * The BYU App surface — a recreation of the BYU mobile app's Calendar tab, carrying our data.
 *
 * Matched from a screen recording of the real app, including colours sampled from the video frames
 * rather than guessed:
 *
 *   page    #041730   card  #0A2D57   bar/tab  #01192C   month header  #076940
 *
 * Structure kept from the real app: hamburger / BYU wordmark / filter funnel header, a green month
 * bar, a seven-day strip with a dot under days that have events, a day heading, then cards with a
 * coloured category stripe down the left, a square thumbnail, and title / host / time stacked.
 * A three-tab bar (Home · Calendar · Search) is pinned to the bottom with Calendar active.
 *
 * What we change, and why — this is the "redesign the calendar page to fit what we're doing" part:
 *
 *   1. **Four layouts inside the tab**, switchable: Day (the app's own), Feed, Discover and Month.
 *      The real app offers only the day list, which answers "what is on this specific date" and
 *      nothing else. A student who wants "what's on this week" has to tap through seven days.
 *   2. **The funnel filters by interest**, not just by category. It is the same interest engine as
 *      every other surface.
 *   3. **Add-to-calendar on the card**, not three taps deep. In the real app you open the event,
 *      then the calendar icon, then pick an app.
 *   4. **Event dots are coloured by category**, so the week strip previews what kind of day it is.
 *
 * On a desktop screen this renders inside a phone frame, because a full-width "mobile app" on a
 * projector reads as a website and undersells the point.
 */
export function ByuAppView({
  events,
  onOpen,
  saved,
  onSave,
  mode,
  onModeChange,
  onOpenFilters,
  query,
  onQueryChange,
  activeFilterCount
}: Props) {
  const savedSet = new Set(saved);

  // Anchor the day/month views on the first matching event rather than today: filtering to
  // "Football" in June and landing on an empty today would read as "nothing is scheduled".
  const firstDate = events.length ? new Date(events[0].start) : new Date();
  const [selectedDay, setSelectedDay] = useState<string>(() => dayKey(firstDate));
  const [cursor, setCursor] = useState(() => new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));

  const firstKey = events.length ? dayKey(events[0].start) : null;
  const lastFirstKey = useRef(firstKey);
  useEffect(() => {
    if (!firstKey || firstKey === lastFirstKey.current) return;
    lastFirstKey.current = firstKey;
    const d = new Date(events[0].start);
    setSelectedDay(dayKey(d));
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [firstKey, events]);

  const byDay = useMemo(() => {
    const map = new Map<string, CampusEvent[]>();
    for (const e of events) {
      const key = dayKey(e.start);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const selectedDate = parseKey(selectedDay);
  const dayEvents = byDay.get(selectedDay) ?? [];

  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden bg-app-bg text-white sm:rounded-[2rem] sm:border-[10px] sm:border-black sm:shadow-lift">
      <div className="flex h-[720px] flex-col sm:h-[780px]">
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between bg-app-bg px-4 py-3">
          <button type="button" aria-label="Menu" className="p-1 text-white/90">
            <Menu className="h-6 w-6" aria-hidden />
          </button>
          <span className="font-sans text-xl font-bold tracking-[0.06em] text-white/95">BYU</span>
          <button
            type="button"
            onClick={onOpenFilters}
            aria-label="Filter events"
            className="relative p-1 text-white/90"
          >
            <Filter className="h-6 w-6" aria-hidden />
            {activeFilterCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-byu-red px-1 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </header>

        {/* Layout switcher — the main addition to the real app's Calendar tab. */}
        <nav aria-label="Calendar layout" className="flex shrink-0 gap-1 bg-app-bg px-3 pb-2.5">
          {MODES.map((m) => {
            const Icon = m.icon;
            const on = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onModeChange(m.id)}
                aria-current={on}
                className={`flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 text-[11px] font-semibold transition-colors ${
                  on ? 'bg-white text-app-bg' : 'bg-white/10 text-white/70 hover:bg-white/15'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {m.label}
              </button>
            );
          })}
        </nav>

        {(mode === 'day' || mode === 'month') && (
          <MonthBar
            cursor={mode === 'month' ? cursor : selectedDate}
            onPrev={() => shift(mode, -1)}
            onNext={() => shift(mode, 1)}
          />
        )}

        {mode === 'day' && (
          <WeekStrip selected={selectedDay} byDay={byDay} onSelect={setSelectedDay} anchor={selectedDate} />
        )}

        {/* Search is its own row in Feed and Discover, where scanning a long list benefits from it. */}
        {(mode === 'feed' || mode === 'discover') && (
          <div className="shrink-0 px-3 pb-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search events"
                aria-label="Search events"
                className="w-full rounded-full border border-white/15 bg-app-card py-2 pl-8 pr-3 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
          {events.length === 0 ? (
            <EmptyAppState />
          ) : mode === 'day' ? (
            <DayList
              date={selectedDate}
              events={dayEvents}
              onOpen={onOpen}
              savedSet={savedSet}
              onSave={onSave}
            />
          ) : mode === 'feed' ? (
            <FeedList events={events} onOpen={onOpen} savedSet={savedSet} onSave={onSave} />
          ) : mode === 'discover' ? (
            <DiscoverList events={events} onOpen={onOpen} savedSet={savedSet} onSave={onSave} />
          ) : (
            <MonthGrid
              cursor={cursor}
              byDay={byDay}
              selected={selectedDay}
              onSelect={(key) => {
                setSelectedDay(key);
                onModeChange('day');
              }}
            />
          )}
        </div>

        {/* Bottom tab bar. Calendar is the active tab; Home and Search are shown because removing
            them would misrepresent the app we are proposing a change to. */}
        <nav aria-label="App sections" className="flex shrink-0 items-center justify-around bg-app-bar px-2 pb-2 pt-2">
          <TabItem icon={Home} label="Home" />
          <TabItem icon={CalendarIcon} label="Calendar" active />
          <TabItem icon={Search} label="Search" />
        </nav>
      </div>
    </div>
  );

  function shift(current: AppMode, delta: number) {
    if (current === 'month') {
      setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
      return;
    }
    const next = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + delta * 7);
    setSelectedDay(dayKey(next));
  }
}

const MODES: { id: AppMode; label: string; icon: LucideIcon }[] = [
  { id: 'day', label: 'Day', icon: Rows3 },
  { id: 'feed', label: 'Feed', icon: List },
  { id: 'discover', label: 'Discover', icon: LayoutGrid },
  { id: 'month', label: 'Month', icon: CalendarIcon }
];

/** The green month header. #076940 was sampled from the recording. */
function MonthBar({ cursor, onPrev, onNext }: { cursor: Date; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-2 bg-app-green px-4 py-2.5">
      <button type="button" onClick={onPrev} aria-label="Previous" className="p-1 text-white">
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <h2 className="flex-1 text-lg font-medium text-white">
        {new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', month: 'long', year: 'numeric' }).format(cursor)}
      </h2>
      <button type="button" onClick={onNext} aria-label="Next" className="p-1 text-white">
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}

function WeekStrip({
  selected,
  byDay,
  onSelect,
  anchor
}: {
  selected: string;
  byDay: Map<string, CampusEvent[]>;
  onSelect: (key: string) => void;
  anchor: Date;
}) {
  // The week containing the selected day, Sunday-first, matching the real app.
  const sunday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay());
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
    return { date, key: dayKey(date) };
  });

  return (
    <div className="grid shrink-0 grid-cols-7 bg-app-bar px-1 py-2">
      {days.map(({ date, key }) => {
        const on = key === selected;
        const dayEvents = byDay.get(key) ?? [];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            aria-current={on}
            aria-label={`${date.toDateString()}, ${dayEvents.length} events`}
            className="flex flex-col items-center gap-1 py-1"
          >
            <span className="text-[11px] font-medium text-white/60">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()]}
            </span>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                on ? 'bg-white text-app-bg' : 'text-white'
              }`}
            >
              {date.getDate()}
            </span>
            {/* Up to three dots, coloured by category — the real app shows one neutral dot, which
                tells you something is on but not what kind. */}
            <span className="flex h-1.5 items-center gap-0.5">
              {dayEvents.slice(0, 3).map((e) => (
                <span
                  key={e.id}
                  className="h-1 w-1 rounded-full"
                  style={{ backgroundColor: `var(--cat-${accentFor(e)})` }}
                />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DayList({
  date,
  events,
  onOpen,
  savedSet,
  onSave
}: {
  date: Date;
  events: CampusEvent[];
  onOpen: (e: CampusEvent) => void;
  savedSet: Set<string>;
  onSave: (id: string) => void;
}) {
  return (
    <>
      <h3 className="py-3 text-lg text-white">
        {new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Denver',
          month: 'long',
          day: '2-digit',
          year: 'numeric'
        }).format(date)}
      </h3>
      {events.length === 0 ? (
        <p className="rounded-xl bg-app-card p-4 text-center text-sm text-white/60">
          Nothing on this day matches your interests.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {events.map((event) => (
            <li key={event.id}>
              <AppCard
                event={event}
                onOpen={() => onOpen(event)}
                saved={savedSet.has(event.id)}
                onSave={() => onSave(event.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function FeedList({
  events,
  onOpen,
  savedSet,
  onSave
}: {
  events: CampusEvent[];
  onOpen: (e: CampusEvent) => void;
  savedSet: Set<string>;
  onSave: (id: string) => void;
}) {
  const days = groupByDay(events).slice(0, 40);
  return (
    <div className="flex flex-col gap-4 pt-2">
      {days.map((day) => (
        <section key={day.key}>
          <h3 className="sticky top-0 z-10 -mx-3 bg-app-bg/95 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-app-sky backdrop-blur">
            {relativeDayLabel(day.date)}
            <span className="ml-2 font-medium normal-case tracking-normal text-white/40">
              {day.events.length}
            </span>
          </h3>
          <ul className="flex flex-col gap-2">
            {day.events.map((event) => (
              <li key={event.id}>
                <AppCard
                  event={event}
                  compact
                  onOpen={() => onOpen(event)}
                  saved={savedSet.has(event.id)}
                  onSave={() => onSave(event.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DiscoverList({
  events,
  onOpen,
  savedSet,
  onSave
}: {
  events: CampusEvent[];
  onOpen: (e: CampusEvent) => void;
  savedSet: Set<string>;
  onSave: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 pt-2">
      {events.slice(0, 60).map((event) => {
        const price = formatPrice(event);
        return (
          <article
            key={event.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(event)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(event);
              }
            }}
            className="flex cursor-pointer flex-col overflow-hidden rounded-xl bg-app-card"
          >
            <div className="relative aspect-[4/3] bg-app-bar">
              {event.image ? (
                <img src={event.image} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center p-2 text-center"
                  style={{ backgroundColor: `var(--cat-${accentFor(event)})` }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wide text-white/90">
                    {event.category}
                  </span>
                </div>
              )}
              <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                {relativeDayLabel(new Date(event.start))}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-1 p-2.5">
              <p className="text-[11px] font-semibold text-app-sky">{formatTimeRange(event)}</p>
              <h4 className="line-clamp-2 text-[13px] font-semibold leading-snug text-white">
                {event.title}
              </h4>
              {price && (
                <p className={`text-[11px] ${price === 'Free' ? 'text-emerald-400' : 'text-white/50'}`}>
                  {price}
                </p>
              )}
              <div className="mt-auto pt-1.5" onClick={(e) => e.stopPropagation()}>
                <AddButton event={event} saved={savedSet.has(event.id)} onSave={() => onSave(event.id)} />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MonthGrid({
  cursor,
  byDay,
  selected,
  onSelect
}: {
  cursor: Date;
  byDay: Map<string, CampusEvent[]>;
  selected: string;
  onSelect: (key: string) => void;
}) {
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { date, key: dayKey(date), inMonth: date.getMonth() === cursor.getMonth() };
    });
  }, [cursor]);

  const todayKey = dayKey(new Date());

  return (
    <div className="pt-2">
      <div className="grid grid-cols-7 pb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="text-center text-[11px] font-semibold text-white/40">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const dayEvents = byDay.get(cell.key) ?? [];
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelect(cell.key)}
              aria-label={`${cell.date.toDateString()}, ${dayEvents.length} events`}
              className={`flex aspect-square flex-col items-center justify-start gap-0.5 rounded-lg p-1 ${
                cell.key === selected ? 'ring-2 ring-white' : ''
              } ${cell.inMonth ? 'bg-app-card' : 'bg-app-card/40'}`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                  cell.key === todayKey ? 'bg-white text-app-bg' : cell.inMonth ? 'text-white' : 'text-white/30'
                }`}
              >
                {cell.date.getDate()}
              </span>
              <span className="flex flex-wrap justify-center gap-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className="h-1 w-1 rounded-full"
                    style={{ backgroundColor: `var(--cat-${accentFor(e)})` }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <p className="pt-2 text-center text-[11px] text-white/40">Tap a day to open it</p>
    </div>
  );
}

/** The app's event card: category stripe, thumbnail, then title / host / time. */
function AppCard({
  event,
  onOpen,
  saved,
  onSave,
  compact
}: {
  event: CampusEvent;
  onOpen: () => void;
  saved: boolean;
  onSave: () => void;
  compact?: boolean;
}) {
  const price = formatPrice(event);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex cursor-pointer gap-2.5 overflow-hidden rounded-xl bg-app-card p-2.5"
    >
      <span
        className="w-1 shrink-0 self-stretch rounded-full"
        style={{ backgroundColor: `var(--cat-${accentFor(event)})` }}
        aria-hidden
      />
      {event.image && !compact && (
        <img src={event.image} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <h4 className="text-[15px] font-semibold leading-snug text-white">{event.title}</h4>
        {event.orgs.length > 0 && (
          <p className="truncate text-[13px] leading-snug text-white/60">{event.orgs[0]}</p>
        )}
        <p className="text-[13px] leading-snug text-white/80">
          {formatTimeRange(event)}
          {event.location ? `, ${event.location}` : ''}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-app-sky">
            {INTEREST_LABELS[event.interests[0]] ?? event.category}
          </span>
          {price && (
            <span className={`text-[11px] ${price === 'Free' ? 'text-emerald-400' : 'text-white/50'}`}>
              {price}
            </span>
          )}
          <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
            <AddButton event={event} saved={saved} onSave={onSave} />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Compact add-to-calendar. One tap to Google Calendar, which is where most students live. */
function AddButton({ event, saved, onSave }: { event: CampusEvent; saved: boolean; onSave: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        window.open(googleCalendarUrl(event), '_blank', 'noopener,noreferrer');
        if (!saved) onSave();
      }}
      aria-label={`Add ${event.title} to calendar`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
        saved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/15 text-white hover:bg-white/25'
      }`}
    >
      <CalendarPlus className="h-3 w-3" aria-hidden />
      {saved ? 'Added' : 'Add'}
    </button>
  );
}

function TabItem({ icon: Icon, label, active }: { icon: LucideIcon; label: string; active?: boolean }) {
  return (
    <span className="flex flex-1 flex-col items-center gap-1">
      <span
        className={`flex h-8 w-16 items-center justify-center rounded-full ${
          active ? 'bg-white text-app-bg' : 'text-white'
        }`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="text-[11px] text-white">{label}</span>
    </span>
  );
}

function EmptyAppState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-app-card p-8 text-center">
      <MapPin className="h-6 w-6 text-white/30" aria-hidden />
      <p className="text-sm text-white/70">No events match your filters.</p>
    </div>
  );
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
