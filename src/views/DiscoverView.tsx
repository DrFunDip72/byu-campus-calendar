import { CalendarDays, MapPin } from 'lucide-react';
import type { CampusEvent } from '../lib/types';
import { accentFor, INTEREST_LABELS } from '../lib/data';
import { excerpt, formatPrice, formatShortDay, formatTimeRange, relativeDayLabel } from '../lib/format';
import { AddToCalendar } from '../components/AddToCalendar';

interface Props {
  events: CampusEvent[];
  onOpen: (e: CampusEvent) => void;
  saved: string[];
  onSave: (id: string) => void;
}

/**
 * Design 2 — Discover.
 *
 * The thesis: students do not only arrive with a question, they also arrive bored. This design
 * optimizes for "show me something I did not know I wanted", so it leads with the event artwork
 * that BYU already publishes — 349 of 385 events in the snapshot carry an ImgUrl, which is the only
 * reason an image-led design is viable at all.
 *
 * Structure is editorial rather than chronological: a featured lead card, then horizontal rails for
 * "This weekend" and "Coming up", then the full grid. Rails matter because a vertical-only grid of
 * image cards makes a student scroll past three events per screen.
 *
 * Trade-off: roughly a third of the information density of the Feed, and it flatters events with
 * good artwork over events that are a better match. It is the right default for a homepage or a
 * digital-signage screen, not for "what is happening in the next hour".
 */
export function DiscoverView({ events, onOpen, saved, onSave }: Props) {
  const savedSet = new Set(saved);
  const [lead, ...rest] = events;

  // The rails are slices of the same filtered list, so they never contradict the grid below.
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 86_400_000);
  const soon = rest.filter((e) => new Date(e.start) < weekEnd);
  const later = rest.filter((e) => new Date(e.start) >= weekEnd);

  if (!lead) return null;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <LeadCard
          event={lead}
          onOpen={() => onOpen(lead)}
          saved={savedSet.has(lead.id)}
          onSave={() => onSave(lead.id)}
        />
      </section>

      {soon.length > 0 && (
        <Rail title="Happening this week" count={soon.length}>
          {soon.map((event) => (
            <div key={event.id} className="w-[260px] shrink-0 snap-start">
              <Card
                event={event}
                onOpen={() => onOpen(event)}
                saved={savedSet.has(event.id)}
                onSave={() => onSave(event.id)}
              />
            </div>
          ))}
        </Rail>
      )}

      {later.length > 0 && (
        <section>
          <h2 className="mb-3 font-serif text-xl text-ink">
            Further out
            <span className="ml-2 align-middle text-xs font-sans font-medium text-muted">
              {later.length} {later.length === 1 ? 'event' : 'events'}
            </span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {later.map((event) => (
              <Card
                key={event.id}
                event={event}
                onOpen={() => onOpen(event)}
                saved={savedSet.has(event.id)}
                onSave={() => onSave(event.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Rail({
  title,
  count,
  children
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 font-serif text-xl text-ink">
        {title}
        <span className="ml-2 align-middle text-xs font-sans font-medium text-muted">
          {count} {count === 1 ? 'event' : 'events'}
        </span>
      </h2>
      {/* Horizontal scroll with snap points, and a negative margin so cards bleed to the edge on mobile. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {children}
      </div>
    </section>
  );
}

function LeadCard({
  event,
  onOpen,
  saved,
  onSave
}: {
  event: CampusEvent;
  onOpen: () => void;
  saved: boolean;
  onSave: () => void;
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
      className="group relative flex min-h-[320px] cursor-pointer overflow-hidden rounded-2xl bg-navy shadow-card transition-shadow duration-200 hover:shadow-lift"
    >
      {event.image && (
        <img
          src={event.image}
          alt={event.imageAlt ?? ''}
          className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          loading="eager"
        />
      )}
      {/* Gradient rather than a flat scrim: BYU's artwork is often light at the top, and text needs
          a reliable contrast floor without washing out the whole image. */}
      <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/75 to-navy/10" aria-hidden />
      <div className="relative mt-auto flex w-full flex-col gap-3 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            Next up · {relativeDayLabel(new Date(event.start))}
          </span>
          {price && (
            <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur">
              {price}
            </span>
          )}
        </div>
        <h2 className="max-w-3xl font-serif text-2xl leading-tight text-white sm:text-4xl">
          {event.title}
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-navy-100">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" aria-hidden />
            {formatShortDay(event.start)} · {formatTimeRange(event)}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" aria-hidden />
              {event.location}
            </span>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()} className="mt-1">
          <AddToCalendar event={event} saved={saved} onSave={onSave} />
        </div>
      </div>
    </div>
  );
}

function Card({
  event,
  onOpen,
  saved,
  onSave
}: {
  event: CampusEvent;
  onOpen: () => void;
  saved: boolean;
  onSave: () => void;
}) {
  const price = formatPrice(event);
  const accent = accentFor(event);
  const text = excerpt(event, 110);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-line bg-white shadow-card transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-navy-50">
        {event.image ? (
          <img
            src={event.image}
            alt={event.imageAlt ?? ''}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          // No artwork: a typographic fallback beats a grey box, and it keeps the grid even.
          <div
            className="flex h-full w-full items-center justify-center p-4 text-center"
            style={{ backgroundColor: `var(--cat-${accent})` }}
          >
            <span className="font-serif text-lg leading-tight text-white/95">{event.category}</span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-white/95 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy shadow-card">
          {relativeDayLabel(new Date(event.start))}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-baseline gap-2 text-xs text-muted">
          <span className="font-semibold text-royal">{formatTimeRange(event)}</span>
          {price && <span className={price === 'Free' ? 'text-emerald-700' : ''}>{price}</span>}
        </div>
        <h3 className="font-serif text-[17px] font-semibold leading-snug text-ink group-hover:text-royal">
          {event.title}
        </h3>
        {text && <p className="line-clamp-2 text-xs leading-relaxed text-muted">{text}</p>}
        {event.location && (
          <p className="inline-flex items-center gap-1 text-xs text-muted">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{event.location}</span>
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="truncate rounded bg-navy-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-navy-700">
            {INTEREST_LABELS[event.interests[0]] ?? event.category}
          </span>
          <div onClick={(e) => e.stopPropagation()}>
            <AddToCalendar event={event} saved={saved} onSave={onSave} size="sm" />
          </div>
        </div>
      </div>
    </article>
  );
}
