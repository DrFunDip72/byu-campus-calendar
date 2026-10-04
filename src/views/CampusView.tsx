import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import type { CampusEvent } from '../lib/types';
import { INTEREST_LABELS } from '../lib/data';
import { excerpt, formatPrice, formatTime } from '../lib/format';
import { AddToCalendar } from '../components/AddToCalendar';

interface Props {
  events: CampusEvent[];
  onOpen: (e: CampusEvent) => void;
  saved: string[];
  onSave: (id: string) => void;
  /** Null on the home view; a BYU category name when one is selected in the nav. */
  activeCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

/**
 * Design 4 — Campus. A recreation of calendar.byu.edu/home, carrying our data and features.
 *
 * Built from the real page rather than from memory. calendar.byu.edu is a Brightspot site whose
 * home page is a stack of category rows, each one a `ListCardImageOnTop` containing
 * `PromoCardImageOnTop` cards. Specifics matched from its own stylesheet:
 *
 *   - Section heading is a solid navy (#002e5d) bar, white text, 16px/1.6, bold, letter-spacing 1px,
 *     padding-left 5px, margin-bottom 5px.  (.ListCardImageOnTopRow > .ListCardImageOnTop-title)
 *   - Card date and time are 11px, weight 300, letter-spacing .5px, uppercase, charcoal.
 *     (.PromoCardImageOnTop-eventDate / -eventTime)
 *   - Card title 20px, description 14px.  (.list-5 variants)
 *   - The drop shadow sits on the *image*, not the card: 0 10px 20px rgba(0,0,0,.05).
 *     (.promo-has-dropshadow .…-media img)
 *   - Rows are carousels with square outlined prev/next buttons.  (.btn-carousel, 30px)
 *   - Square corners throughout; the real site uses no border radius.
 *
 * One rule was deliberately *not* copied: `.PromoCardImageOnTop { border: 2px solid #000 }` is
 * inside an `@media print` block on the real site, so applying it on screen would have been wrong.
 *
 * Why this design exists: the other three argue for a better calendar. This one shows BYU
 * leadership the same data inside their own design system, so the conversation can be about the
 * idea rather than about whether it would fit the site.
 *
 * Trade-off: it is the least adventurous layout and inherits the real site's weaknesses — a
 * carousel row shows three events at a time and hides the rest behind a click, which is why the
 * other designs exist. It is also the only design whose look is constrained rather than chosen.
 */
export function CampusView({
  events,
  onOpen,
  saved,
  onSave,
  activeCategory,
  onSelectCategory
}: Props) {
  const savedSet = new Set(saved);

  // A category selected in the nav narrows the same already-filtered list, so the nav composes
  // with the interest filters rather than overriding them.
  const visible = useMemo(
    () => (activeCategory ? events.filter((e) => e.category === activeCategory) : events),
    [events, activeCategory]
  );

  // Home view: one row per BYU category, in the site's own order. Category view: a flat grid of
  // everything in that category, which is what the real site's category pages do.
  const rows = useMemo(() => {
    if (activeCategory) return [];
    const byCategory = new Map<string, CampusEvent[]>();
    for (const event of events) {
      const list = byCategory.get(event.category) ?? [];
      list.push(event);
      byCategory.set(event.category, list);
    }
    // Departments surface as their own category once `categories=all` is used ("School of Music"),
    // so rows are ordered by how much is actually in them rather than by a fixed list. That keeps
    // the page dense at the top no matter which filters are on.
    return [...byCategory.entries()]
      .map(([category, list]) => ({ category, events: list }))
      .sort((a, b) => b.events.length - a.events.length);
  }, [events, activeCategory]);

  if (!events.length) return null;

  return (
    <div className="font-sans">
      {activeCategory ? (
        <section>
          <SectionHeading
            label={activeCategory}
            count={visible.length}
            onClick={() => onSelectCategory(null)}
            backLabel="All categories"
          />
          {visible.length === 0 ? (
            // A nav category can be empty once interest filters are on. Saying which two things
            // conflict is more useful than an empty page.
            <p className="border border-byu-rule bg-white p-6 text-center text-sm text-byu-charcoal">
              Nothing in <span className="font-semibold">{activeCategory}</span> matches your current
              interests and search.{' '}
              <button
                type="button"
                onClick={() => onSelectCategory(null)}
                className="font-semibold text-byu-link hover:underline"
              >
                Back to all categories
              </button>
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((event) => (
                <PromoCard
                  key={event.id}
                  event={event}
                  onOpen={() => onOpen(event)}
                  saved={savedSet.has(event.id)}
                  onSave={() => onSave(event.id)}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="flex flex-col gap-9">
          {rows.map((row) => (
            <CategoryRow
              key={row.category}
              category={row.category}
              events={row.events}
              onOpen={onOpen}
              savedSet={savedSet}
              onSave={onSave}
              onViewAll={() => onSelectCategory(row.category)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** The navy bar heading, matched to .ListCardImageOnTopRow > .ListCardImageOnTop-title. */
function SectionHeading({
  label,
  count,
  onClick,
  backLabel
}: {
  label: string;
  count: number;
  onClick?: () => void;
  backLabel?: string;
}) {
  return (
    <div className="mb-[5px] flex items-center justify-between gap-3 bg-byu-navy pl-[5px] pr-2">
      <h2 className="py-0.5 text-[16px] font-bold leading-[1.6] tracking-[1px] text-white">
        {label}
      </h2>
      <span className="flex items-center gap-3">
        <span className="whitespace-nowrap text-[11px] font-light uppercase tracking-[0.5px] text-white/70">
          {count} {count === 1 ? 'event' : 'events'}
        </span>
        {onClick && backLabel && (
          <button
            type="button"
            onClick={onClick}
            className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.5px] text-byu-sky hover:text-white hover:underline"
          >
            ← {backLabel}
          </button>
        )}
      </span>
    </div>
  );
}

function CategoryRow({
  category,
  events,
  onOpen,
  savedSet,
  onSave,
  onViewAll
}: {
  category: string;
  events: CampusEvent[];
  onOpen: (e: CampusEvent) => void;
  savedSet: Set<string>;
  onSave: (id: string) => void;
  onViewAll: () => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // The real site's rows are Flickity carousels. This is a native scroll-snap track instead — same
  // interaction, but it keeps keyboard and touch scrolling working for free, and the prev/next
  // buttons disable at the ends the way Flickity's do.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => {
      setAtStart(el.scrollLeft <= 2);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [events]);

  const scrollBy = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(280, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  return (
    <section>
      <SectionHeading label={category} count={events.length} />
      <div
        ref={track}
        className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2"
      >
        {events.map((event) => (
          <div key={event.id} className="w-[270px] shrink-0 snap-start sm:w-[300px]">
            <PromoCard
              event={event}
              onOpen={() => onOpen(event)}
              saved={savedSet.has(event.id)}
              onSave={() => onSave(event.id)}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3">
        {/* "Full Schedule" is the real site's row CTA wording. */}
        <button
          type="button"
          onClick={onViewAll}
          className="border border-byu-navy bg-byu-navy px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.05em] text-white transition-colors hover:bg-white hover:text-byu-navy"
        >
          Full Schedule
        </button>
        <span className="ml-auto flex gap-2">
          <CarouselButton label="Previous" disabled={atStart} onClick={() => scrollBy(-1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </CarouselButton>
          <CarouselButton label="Next" disabled={atEnd} onClick={() => scrollBy(1)}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </CarouselButton>
        </span>
      </div>
    </section>
  );
}

/** .btn-carousel: transparent, 1px border, square, fills on hover, 50% opacity when disabled. */
function CarouselButton({
  label,
  disabled,
  onClick,
  children
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-[30px] w-[30px] items-center justify-center border border-byu-navy bg-transparent text-byu-navy transition-colors hover:bg-byu-navy hover:text-white disabled:pointer-events-none disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/**
 * PromoCardImageOnTop. White card, image on top with the shadow on the image itself, then the
 * category label, title, the stacked time/date block, and an optional description.
 */
function PromoCard({
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
  const description = excerpt(event, 100);

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
      className="group flex h-full cursor-pointer flex-col bg-white"
    >
      <div className="mb-3 overflow-hidden">
        {event.image ? (
          <img
            src={event.image}
            alt={event.imageAlt ?? ''}
            loading="lazy"
            className="aspect-[4/3] w-full object-cover shadow-[0_10px_20px_0_rgba(0,0,0,0.05)]"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-byu-grey px-4 text-center shadow-[0_10px_20px_0_rgba(0,0,0,0.05)]">
            <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-byu-slate">
              {event.category}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col">
        {/* The lead-in style from BYU's override stylesheet: uppercase, 700, 90%, .05em. */}
        <div className="mb-2.5 text-[13px] font-bold uppercase leading-tight tracking-[0.05em] text-byu-link">
          {INTEREST_LABELS[event.interests[0]] ?? event.category}
        </div>

        <h3 className="mb-2.5 text-[20px] font-semibold leading-[1.25] text-byu-navy group-hover:underline">
          {event.title}
        </h3>

        <div className="mb-2.5 flex flex-col gap-0.5 text-[11px] font-light uppercase leading-[1.27] tracking-[0.5px] text-byu-charcoal">
          <span>{event.allDay ? 'All day' : formatTime(event.start)}</span>
          <span>{longDate(event.start)}</span>
        </div>

        {description && (
          <p className="mb-3 line-clamp-2 text-[14px] leading-[1.5] text-byu-charcoal">
            {description}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-1">
          {(event.location || price) && (
            <div className="flex items-center gap-2 text-[12px] text-byu-slate">
              {event.location && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{event.location}</span>
                </span>
              )}
              {price && (
                <span className={`ml-auto shrink-0 font-semibold ${price === 'Free' ? 'text-emerald-700' : ''}`}>
                  {price}
                </span>
              )}
            </div>
          )}
          {/* Add-to-calendar is ours, not BYU's: the real site has no equivalent, and it is the
              single clearest thing this proposal adds to the page they already have. */}
          <div onClick={(e) => e.stopPropagation()}>
            <AddToCalendar event={event} saved={saved} onSave={onSave} size="sm" fullWidth />
          </div>
        </div>
      </div>
    </article>
  );
}

/** "Tuesday, October 06" — the real site's event date format, including the zero-padded day. */
function longDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    weekday: 'long',
    month: 'long',
    day: '2-digit'
  }).format(new Date(iso));
}
