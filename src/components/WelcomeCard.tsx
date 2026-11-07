import { useCallback, useEffect, useState } from 'react';
import { ArrowDownRight, LayoutGrid, MessageSquarePlus, Smartphone } from 'lucide-react';
import { DEMO_COUNT, REAL_COUNT } from '../lib/data';

/**
 * The arrival card.
 *
 * It exists because of a specific failure: the only route to the feedback form was a text link in
 * the footer plus a bar that waited 25 seconds, so a student who looked around for a minute and
 * left never saw either. A pitch that depends on collected opinions cannot hide the place where
 * opinions go.
 *
 * Three jobs, in priority order:
 *
 *   1. Say what this is. "Not an official BYU site" has to be the first thing read, because the
 *      BYU Website placement is a faithful enough copy that a student could otherwise believe
 *      they are filing feedback with the university.
 *   2. Teach the feedback button. The card is modal, and the floating button is deliberately
 *      lifted above the scrim while it is open, so the one lit thing on a dimmed screen is the
 *      control the card is describing. Pointing at a button nobody can see teaches nothing.
 *   3. Explain the two axes in one sentence. This is the thing that was hardest to narrate out
 *      loud, so it gets said once, in words, before anyone has to infer it from a toolbar.
 *
 * It shows once per browser and is never shown again, dismissal or submission alike. `?welcome=0`
 * suppresses it outright, which is what a live demo or a screenshot run should use.
 */

const STORAGE_KEY = 'byu-campus-calendar.welcome.v1';

export function useWelcomeCard() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Recorded, not just honoured for this render: the URL is rewritten from the filter state on
    // every change, so `?welcome=0` is gone from the address bar within a second and would not
    // survive the first reload during a demo.
    if (new URLSearchParams(window.location.search).get('welcome') === '0') {
      try {
        localStorage.setItem(STORAGE_KEY, 'suppressed');
      } catch {
        /* nothing to do; the flag still held for this page load */
      }
      return;
    }
    let seen = false;
    try {
      seen = localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      /* private browsing: show it, and simply fail to remember that we did */
    }
    if (!seen) setOpen(true);
  }, []);

  // Stable, because App derives its "open the survey" callback from this one.
  const close = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* it reappears next visit, which is a tolerable failure */
    }
    setOpen(false);
  }, []);

  return { welcomeOpen: open, closeWelcome: close };
}

export function WelcomeCard({
  open,
  onClose,
  onGiveFeedback
}: {
  open: boolean;
  onClose: () => void;
  /** Dismisses the card and opens the form straight away, for someone who already has an opinion. */
  onGiveFeedback: () => void;
}) {
  // Escape closes it. A modal that can only be dismissed by hitting the right pixel is a trap.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      {/* Clicking anywhere off the card dismisses it — the "click out of the main card" path. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/70 backdrop-blur-[2px]"
      />

      {/* The bottom margin keeps the card clear of the floating button it is pointing at, and the
          height cap plus scrolling body is what stops a narrow phone — where this text wraps to
          nearly twice the height it occupies on a laptop — from pushing both buttons off screen
          inside an overflow-hidden box. */}
      <div className="relative mb-16 flex max-h-[calc(100vh-7rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-lift sm:mb-0 sm:max-h-[88vh]">
        <div className="shrink-0 bg-navy px-5 py-4 text-white sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-navy-200">
            Student project &mdash; not an official BYU site
          </p>
          <h2 id="welcome-title" className="mt-1 text-xl font-bold leading-tight sm:text-2xl">
            Thanks for taking a look.
          </h2>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-5 sm:px-6">
          <p className="text-sm leading-relaxed text-ink">
            This is a proposal for <span className="font-semibold">one BYU events calendar</span>,
            built by two students after the CS Homecoming Hackathon. It runs on{' '}
            <span className="font-semibold">{REAL_COUNT} real events</span> from BYU&rsquo;s public
            calendar API, plus {DEMO_COUNT} stand-ins marked{' '}
            <span className="rounded bg-amber-100 px-1 py-px text-[10px] font-bold uppercase tracking-wide text-amber-900">
              demo
            </span>{' '}
            for the categories that feed does not have.
          </p>

          <div className="rounded-xl border border-line bg-canvas p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400">
              Two things to try
            </p>
            <ul className="mt-2 flex flex-col gap-2 text-sm text-ink">
              <li className="flex gap-2.5">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-royal" aria-hidden />
                <span>
                  <span className="font-semibold">Where it would live</span> &mdash; the BYU website,
                  inside the BYU app, or its own site.
                </span>
              </li>
              <li className="flex gap-2.5">
                <LayoutGrid className="mt-0.5 h-4 w-4 shrink-0 text-royal" aria-hidden />
                <span>
                  <span className="font-semibold">How events are laid out</span> &mdash; a list, cards,
                  or a month grid.
                </span>
              </li>
            </ul>
            <p className="mt-2.5 text-xs leading-relaxed text-muted">
              Both switch from the bar at the top. Pick your interests and the feed changes.
            </p>
          </div>

          {/* The whole point of the card. The live button is raised above the scrim, so this
              sentence has something lit to refer to rather than describing a hidden control. */}
          <div className="flex items-center gap-3 rounded-xl border border-royal-200 bg-royal-50 p-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-white">
              <MessageSquarePlus className="h-5 w-5" aria-hidden />
            </span>
            <p className="min-w-0 flex-1 text-sm leading-snug text-ink">
              <span className="font-semibold">Tell us what you think any time.</span> This button
              sits in the bottom-right corner on every screen.
            </p>
            <ArrowDownRight className="hidden h-5 w-5 shrink-0 animate-bounce text-royal sm:block" aria-hidden />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onGiveFeedback}
              className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-canvas"
            >
              Give feedback now
            </button>
            <button
              type="button"
              onClick={onClose}
              autoFocus
              className="rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-600"
            >
              Start exploring
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
