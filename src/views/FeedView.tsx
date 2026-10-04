import { Fragment } from 'react';
import { Bookmark, BookmarkCheck, MapPin } from 'lucide-react';
import type { CampusEvent } from '../lib/types';
import { accentFor, INTEREST_LABELS } from '../lib/data';
import { formatPrice, formatTimeRange, relativeDayLabel } from '../lib/format';
import { groupByDay } from '../lib/filters';
import { AddToCalendar } from '../components/AddToCalendar';

interface Props {
  events: CampusEvent[];
  onOpen: (e: CampusEvent) => void;
  saved: string[];
  onSave: (id: string) => void;
}

/**
 * Design 1 — Feed.
 *
 * The thesis: a student checking "what's on today" wants *answers per screen*, not atmosphere. So
 * this is a dense, text-first list grouped under sticky day headers, with the time in a fixed-width
 * left gutter so the eye can run straight down it. Images are 56px thumbnails, present for
 * recognition but never dictating the row height.
 *
 * Trade-off: it is the least visually exciting of the three and the worst at making an unfamiliar
 * event look appealing. It is the best at answering a specific question quickly, which is why it is
 * the default.
 */
export function FeedView({ events, onOpen, saved, onSave }: Props) {
  const days = groupByDay(events);
  const savedSet = new Set(saved);

  return (
    <div className="flex flex-col">
      {days.map((day) => (
        <Fragment key={day.key}>
          <h2 className="sticky top-[104px] z-20 -mx-1 border-b border-line bg-canvas/95 px-1 py-1.5 text-xs font-bold uppercase tracking-wider text-navy backdrop-blur sm:top-[96px]">
            {relativeDayLabel(day.date)}
            <span className="ml-2 font-medium normal-case tracking-normal text-muted">
              {day.events.length} {day.events.length === 1 ? 'event' : 'events'}
            </span>
          </h2>
          <ul className="mb-2 divide-y divide-line">
            {day.events.map((event) => (
              <FeedRow
                key={event.id}
                event={event}
                onOpen={() => onOpen(event)}
                saved={savedSet.has(event.id)}
                onSave={() => onSave(event.id)}
              />
            ))}
          </ul>
        </Fragment>
      ))}
    </div>
  );
}

function FeedRow({
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

  return (
    <li>
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
        className="group flex cursor-pointer gap-3 py-3 pl-1 pr-1 transition-colors duration-150 hover:bg-white sm:gap-4"
      >
        {/* Fixed-width time gutter: the whole point of this design is a single scannable column. */}
        <div className="w-16 shrink-0 pt-0.5 text-right sm:w-20">
          <div className="text-sm font-semibold tabular-nums text-ink">
            {event.allDay ? 'All day' : formatTimeRange(event).split(' – ')[0]}
          </div>
          {!event.allDay && event.end && (
            <div className="text-[11px] tabular-nums text-muted">
              to {formatTimeRange(event).split(' – ')[1]}
            </div>
          )}
        </div>

        <span
          className="mt-1 h-auto w-[3px] shrink-0 self-stretch rounded-full"
          style={{ backgroundColor: `var(--cat-${accent})` }}
          aria-hidden
        />

        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug text-ink group-hover:text-royal">
            {event.title}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
            {event.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden />
                {event.location}
              </span>
            )}
            {event.orgs.length > 0 && <span>{event.orgs[0]}</span>}
            {price && (
              <span className={price === 'Free' ? 'font-medium text-emerald-700' : 'text-amber-800'}>
                {price}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {event.interests.slice(0, 3).map((id) => (
              <span
                key={id}
                className="rounded bg-navy-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-navy-700"
              >
                {INTEREST_LABELS[id] ?? id}
              </span>
            ))}
          </div>
        </div>

        {event.image && (
          <img
            src={event.image}
            alt=""
            loading="lazy"
            className="hidden h-14 w-14 shrink-0 rounded-lg object-cover sm:block"
          />
        )}

        <div className="flex shrink-0 flex-col items-end justify-center gap-1.5">
          <AddToCalendar event={event} saved={saved} onSave={onSave} size="sm" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            aria-label={saved ? `Remove ${event.title} from saved` : `Save ${event.title}`}
            className="rounded p-1 text-muted hover:bg-canvas hover:text-navy"
          >
            {saved ? (
              <BookmarkCheck className="h-3.5 w-3.5 text-navy" aria-hidden />
            ) : (
              <Bookmark className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </li>
  );
}
