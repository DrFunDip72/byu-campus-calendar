import { useEffect } from 'react';
import { Bookmark, BookmarkCheck, Clock, ExternalLink, MapPin, Tag, Ticket, Users, X } from 'lucide-react';
import type { CampusEvent } from '../lib/types';
import { INTEREST_LABELS } from '../lib/data';
import { formatFull, formatPrice, formatTimeRange } from '../lib/format';
import { AddToCalendar } from './AddToCalendar';

interface Props {
  event: CampusEvent | null;
  onClose: () => void;
  saved: boolean;
  onSave: () => void;
}

/**
 * One detail surface for all three designs. It slides in from the right on desktop and covers the
 * screen on mobile. Keeping it shared means the Feed, Discover and Planner views only have to
 * decide how to *list* events, never how to present one.
 */
export function EventDetail({ event, onClose, saved, onSave }: Props) {
  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    // Locking the background prevents the page scrolling under the panel on mobile.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [event, onClose]);

  if (!event) return null;

  const price = formatPrice(event);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={event.title}
        className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-lift"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-ink shadow-card hover:bg-white"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        {event.image && (
          <img
            src={event.image}
            alt={event.imageAlt ?? ''}
            className="h-52 w-full shrink-0 object-cover"
            loading="lazy"
          />
        )}

        <div className="flex flex-col gap-5 p-5 pb-8 sm:p-6">
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-navy-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-navy-700">
                {event.category}
              </span>
              {price && (
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                    price === 'Free' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {price}
                </span>
              )}
            </div>
            <h1 className="font-serif text-2xl leading-tight text-ink">{event.title}</h1>
          </header>

          <dl className="flex flex-col gap-2.5 text-sm">
            <Row icon={<Clock className="h-4 w-4" aria-hidden />} label="When">
              {formatFull(event.start)}
              <span className="text-muted"> · {formatTimeRange(event)} MT</span>
            </Row>
            {event.location && (
              <Row icon={<MapPin className="h-4 w-4" aria-hidden />} label="Where">
                {event.location}
              </Row>
            )}
            {event.orgs.length > 0 && (
              <Row icon={<Users className="h-4 w-4" aria-hidden />} label="Hosted by">
                {event.orgs.join(', ')}
              </Row>
            )}
            {event.interests.length > 0 && (
              <Row icon={<Tag className="h-4 w-4" aria-hidden />} label="Tagged">
                {event.interests.map((i) => INTEREST_LABELS[i] ?? i).join(', ')}
              </Row>
            )}
          </dl>

          <div className="flex flex-wrap gap-2">
            <AddToCalendar event={event} saved={saved} onSave={onSave} />
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink hover:bg-canvas"
            >
              {saved ? (
                <BookmarkCheck className="h-4 w-4 text-navy" aria-hidden />
              ) : (
                <Bookmark className="h-4 w-4" aria-hidden />
              )}
              {saved ? 'Saved' : 'Save'}
            </button>
            {event.ticketsUrl && (
              <a
                href={event.ticketsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink hover:bg-canvas"
              >
                <Ticket className="h-4 w-4" aria-hidden />
                Tickets
              </a>
            )}
          </div>

          {event.description && (
            <div className="whitespace-pre-line text-sm leading-relaxed text-ink/90">
              {event.description}
            </div>
          )}

          <footer className="flex flex-col gap-2 border-t border-line pt-4 text-xs text-muted">
            {event.url && (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-royal hover:underline"
              >
                View on the official BYU page
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
            <span>
              Source: {event.source.split('+').map(sourceLabel).join(' + ')}
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
}

const sourceLabel = (id: string) =>
  ({ byu_calendar: 'calendar.byu.edu', cs_dept: 'cs.byu.edu' })[id] ?? id;

function Row({
  icon,
  label,
  children
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 shrink-0 text-navy-400">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
        <dd className="text-ink">{children}</dd>
      </div>
    </div>
  );
}
