import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import type { CampusEvent } from '../lib/types';
import { accentFor, INTEREST_LABELS } from '../lib/data';
import { dayKey, formatMonth, formatPrice, formatTimeRange, relativeDayLabel } from '../lib/format';
import { AddToCalendar } from '../components/AddToCalendar';

interface Props {
  events: CampusEvent[];
  onOpen: (e: CampusEvent) => void;
  saved: string[];
  onSave: (id: string) => void;
}

/**
 * Design 3 — Planner.
 *
 * The thesis: the other two designs answer "what is happening". This one answers "what does my
 * month look like", which is the question a student asks when deciding whether they can actually
 * go. A month grid is the only layout that shows density and conflict at a glance — three things on
 * Thursday and nothing all weekend is information neither list can convey.
 *
 * Selecting a day fills the side panel rather than navigating, so the grid stays visible and a
 * student can compare days without losing their place.
 *
 * Trade-off: the grid cells can only fit about three events before truncating, so it is the worst
 * of the three for discovery and the only one that needs real width — it degrades to a day-by-day
 * agenda on a phone. It is also the layout that most looks like a tool rather than a destination.
 */
export function PlannerView({ events, onOpen, saved, onSave }: Props) {
  // Open on the month of the first matching event, not necessarily today: if a student filters to
  // "Football" in June, landing on an empty current month would read as "no events".
  const firstDate = events.length ? new Date(events[0].start) : new Date();
  const [cursor, setCursor] = useState(() => new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(() => (events.length ? dayKey(events[0].start) : null));

  // Filters change under this view, and a stale cursor is worse than no view: narrowing to an
  // interest whose next event is months away would otherwise leave the student on an empty grid
  // with no hint that results exist. Follow the first result's month *only* when it actually moves,
  // so paging around by hand is never yanked back.
  const firstMonth = events.length ? `${firstDate.getFullYear()}-${firstDate.getMonth()}` : null;
  const lastFirstMonth = useRef(firstMonth);
  useEffect(() => {
    if (!firstMonth || firstMonth === lastFirstMonth.current) return;
    lastFirstMonth.current = firstMonth;
    const [year, month] = firstMonth.split('-').map(Number);
    setCursor(new Date(year, month, 1));
    setSelected(dayKey(events[0].start));
  }, [firstMonth, events]);

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

  // Six weeks from the Sunday on or before the 1st: a fixed cell count stops the grid reflowing
  // between months, which is visually jarring when paging through.
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      return { date, key: dayKey(date), inMonth: date.getMonth() === cursor.getMonth() };
    });
  }, [cursor]);

  const todayKey = dayKey(new Date());
  const selectedEvents = selected ? (byDay.get(selected) ?? []) : [];

  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-xl text-ink">{formatMonth(cursor)}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="rounded-lg border border-line bg-white p-1.5 text-ink hover:bg-canvas"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelected(dayKey(now));
              }}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="rounded-lg border border-line bg-white p-1.5 text-ink hover:bg-canvas"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
            <div
              key={label}
              className="bg-canvas py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-muted"
            >
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label[0]}</span>
            </div>
          ))}

          {cells.map((cell) => {
            const dayEvents = byDay.get(cell.key) ?? [];
            const isToday = cell.key === todayKey;
            const isSelected = cell.key === selected;
            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelected(cell.key)}
                aria-label={`${cell.date.toDateString()}, ${dayEvents.length} events`}
                aria-current={isSelected}
                className={`flex min-h-[72px] flex-col gap-0.5 p-1 text-left align-top transition-colors duration-100 sm:min-h-[104px] sm:p-1.5 ${
                  cell.inMonth ? 'bg-white hover:bg-navy-50' : 'bg-canvas/60 hover:bg-canvas'
                } ${isSelected ? 'ring-2 ring-inset ring-royal' : ''}`}
              >
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                    isToday
                      ? 'bg-navy text-white'
                      : cell.inMonth
                        ? 'text-ink'
                        : 'text-muted/50'
                  }`}
                >
                  {cell.date.getDate()}
                </span>

                {/* Two chips plus an overflow count: three rows of text is the most a 104px cell
                    holds without clipping, and an honest "+4 more" beats a silently cut list. */}
                <span className="flex min-w-0 flex-col gap-0.5">
                  {dayEvents.slice(0, 2).map((event) => (
                    <span
                      key={event.id}
                      className="flex min-w-0 items-center gap-1 rounded px-1 py-px text-[10px] leading-tight text-white"
                      style={{ backgroundColor: `var(--cat-${accentFor(event)})` }}
                    >
                      <span className="truncate">{event.title}</span>
                    </span>
                  ))}
                  {dayEvents.length > 2 && (
                    <span className="px-1 text-[10px] font-semibold text-muted">
                      +{dayEvents.length - 2} more
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-[11px] text-muted">
          Colours follow the BYU calendar category. Select a day to see everything on it.
        </p>
      </div>

      {/* Day panel. Sticky on desktop so paging the grid keeps it in view. */}
      <aside className="w-full shrink-0 xl:sticky xl:top-[112px] xl:max-h-[calc(100vh-128px)] xl:w-[340px] xl:overflow-y-auto">
        <div className="rounded-xl border border-line bg-white p-4">
          <h3 className="font-serif text-lg text-ink">
            {selected ? relativeDayLabel(parseKey(selected)) : 'Pick a day'}
          </h3>
          <p className="mb-3 text-xs text-muted">
            {selectedEvents.length
              ? `${selectedEvents.length} ${selectedEvents.length === 1 ? 'event' : 'events'} matching your filters`
              : 'Nothing matching your filters on this day.'}
          </p>
          <ul className="flex flex-col gap-2.5">
            {selectedEvents.map((event) => {
              const price = formatPrice(event);
              return (
                <li key={event.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpen(event)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpen(event);
                      }
                    }}
                    className="group cursor-pointer rounded-lg border border-line p-2.5 transition-colors duration-150 hover:border-navy-200 hover:bg-navy-50/40"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1 h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: `var(--cat-${accentFor(event)})` }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold tabular-nums text-royal">
                          {formatTimeRange(event)}
                        </p>
                        <h4 className="text-sm font-semibold leading-snug text-ink group-hover:text-royal">
                          {event.title}
                        </h4>
                        {event.location && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate">{event.location}</span>
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="rounded bg-navy-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-navy-700">
                            {INTEREST_LABELS[event.interests[0]] ?? event.category}
                          </span>
                          {price && (
                            <span
                              className={`text-[10px] font-medium uppercase tracking-wide ${
                                price === 'Free' ? 'text-emerald-700' : 'text-amber-800'
                              }`}
                            >
                              {price}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                      <AddToCalendar
                        event={event}
                        saved={saved.includes(event.id)}
                        onSave={() => onSave(event.id)}
                        size="sm"
                        fullWidth
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}

/** "2026-10-09" (the en-CA day key) back to a local Date. */
function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
