import { useState } from 'react';
import { ArrowRight, Check, Columns3, X } from 'lucide-react';
import { LAYOUTS } from '../lib/views';
import { LayoutRenderer } from '../views/LayoutRenderer';
import type { CampusEvent, LayoutId } from '../lib/types';

/**
 * All three layouts, at once, on one screen.
 *
 * The switcher can only ever show one layout at a time, which means comparing them is a memory
 * test: click, scroll, remember, click, scroll, try to recall what the first one felt like. People
 * asked for an opinion that way give you the layout they saw last.
 *
 * Showing them in parallel also gives the project a single screenshot that communicates the whole
 * idea — which is what a social post needs and what a one-at-a-time switcher cannot produce.
 *
 * Previews use the purpose-built chrome for all three on purpose. The question here is which
 * *arrangement* of events reads best; wrapping each in a different placement's chrome would change
 * two variables at once and answer neither question.
 */

/** Enough events to show each layout's character; more makes three columns unreadable. */
const PREVIEW_LIMIT = 24;

export function CompareDialog({
  open,
  events,
  current,
  onPick,
  onVote,
  onClose
}: {
  open: boolean;
  events: CampusEvent[];
  current: LayoutId;
  onPick: (layout: LayoutId) => void;
  onVote: (layout: LayoutId) => void;
  onClose: () => void;
}) {
  const [voted, setVoted] = useState<LayoutId | null>(null);

  if (!open) return null;

  const preview = events.slice(0, PREVIEW_LIMIT);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-canvas">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="inline-flex items-center gap-2 font-serif text-lg text-ink sm:text-xl">
            <Columns3 className="h-4 w-4 text-navy-400" aria-hidden />
            Three layouts, same events
          </h2>
          <p className="mt-0.5 text-xs leading-snug text-muted">
            {preview.length} of your {events.length} matching events in each. Which one would you
            actually use?
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close comparison"
          className="shrink-0 rounded-full p-2 text-muted hover:bg-canvas hover:text-ink"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-[1600px] gap-4 p-4 sm:px-6 lg:grid-cols-3">
          {LAYOUTS.map((definition) => {
            const Icon = definition.icon;
            const isCurrent = current === definition.id;
            const isVoted = voted === definition.id;
            return (
              <section
                key={definition.id}
                className={`flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white ${
                  isVoted ? 'border-navy ring-2 ring-navy/20' : 'border-line'
                }`}
              >
                <div className="shrink-0 border-b border-line px-3 py-2.5">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <Icon className="h-4 w-4 text-navy-400" aria-hidden />
                    {definition.label}
                    {isCurrent && (
                      <span className="rounded bg-navy-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy">
                        Current
                      </span>
                    )}
                  </h3>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">{definition.bestFor}</p>
                </div>

                {/* Capped and scrollable: each column shows its own character without the page
                    becoming three full-length feeds stacked end to end.

                    Buttons inside are disabled rather than the whole container, because
                    `pointer-events-none` on the wrapper would also kill scrolling — and scrolling
                    is how someone judges a layout. Without this, the per-event "Add to calendar"
                    controls stay live and a stray click opens a calendar menu on top of the
                    comparison the reader is trying to make. */}
                <div className="max-h-[52vh] min-h-[320px] overflow-y-auto bg-canvas p-2.5 [&_button]:pointer-events-none [&_a]:pointer-events-none">
                  <LayoutRenderer
                    layout={definition.id}
                    events={preview}
                    onOpen={() => {
                      /* Previews are deliberately inert — opening a detail sheet from inside the
                         comparison would cover the very thing being compared. */
                    }}
                    saved={[]}
                    onSave={() => {}}
                  />
                </div>

                <div className="flex shrink-0 gap-2 border-t border-line p-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setVoted(definition.id);
                      onVote(definition.id);
                    }}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      isVoted
                        ? 'border-navy bg-navy text-white'
                        : 'border-line bg-white text-ink hover:border-navy-200 hover:bg-canvas'
                    }`}
                  >
                    {isVoted ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        My pick
                      </>
                    ) : (
                      'I prefer this'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(definition.id);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-navy-600"
                  >
                    Open
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </section>
            );
          })}
        </div>

        <p className="mx-auto max-w-[1600px] px-4 pb-6 text-xs leading-relaxed text-muted sm:px-6">
          Each layout also works inside BYU&rsquo;s existing website and app — close this and use
          the <span className="font-semibold text-ink">Where this lives</span> row to see any of
          these three wearing BYU&rsquo;s own design.
          {voted && (
            <>
              {' '}
              <span className="font-semibold text-navy">
                Thanks — your pick was recorded anonymously.
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
