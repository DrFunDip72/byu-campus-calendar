import { useEffect, useState } from 'react';
import { Check, MessageSquare, MessageSquarePlus, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { LAYOUTS } from '../lib/views';
import { trackFeedback } from '../lib/analytics';
import type { LayoutId, PlacementId } from '../lib/types';

/**
 * The feedback button, and the pop-up it opens.
 *
 * "Tell me what you think" on a social post gets you five comments from people who already like
 * you. Asking inside the product, at the moment someone has just used it, gets a number — and a
 * number is what a pitch needs: "64% of 71 students picked the list layout" is an argument, where
 * "people seemed to like it" is not.
 *
 * Two earlier versions got this wrong, in instructive ways.
 *
 * The first appeared on a 25-second timer and was otherwise reachable only through a text link in
 * the footer, so the route in was invisible to anyone who looked around briefly and left.
 *
 * The second parked a permanent button in the corner but **hid it whenever the survey was open**,
 * and the survey was a bar pinned to the bottom edge of the window. Those two choices combined
 * into a disappearing act: the button is deliberately raised above the arrival card's scrim so the
 * card can point at it, which also makes it the one clickable thing over a dimmed screen. Pressing
 * it therefore read as "clicking out of the card" — and the reward for that was the button
 * vanishing while a bar appeared at the far bottom of the page, nowhere near where the click
 * happened. Every part of that was defensible on its own and the whole was indefensible.
 *
 * So, two rules now, and they are not negotiable by a future state machine:
 *
 *   1. **The button is unconditional.** It renders on every placement, every layout, and in every
 *      stage of the survey, including while the survey is open. Nothing — no timer, no stored
 *      dismissal, no open dialog — removes it. A control that is permanent can be learned once;
 *      one that comes and goes has to be rediscovered every time.
 *   2. **The survey is a pop-up at the centre of the screen.** It appears where attention already
 *      is, as a direct consequence of the press. A bar at the bottom edge of a tall page is not a
 *      response to a click in the corner; it is a separate event happening elsewhere.
 *
 * Everything is asked on one screen. The thumbs-up/down is the only required answer, because the
 * verdict is the number the pitch actually turns on; the rest is optional and can be skipped.
 *
 * Submission is doubly recorded on purpose — Blob storage for the written comments, an analytics
 * event for the count — because the count must survive a storage failure, and the comments cannot
 * be reconstructed from a count. See lib/analytics.ts and api/feedback.ts.
 */

/** How long the button keeps its label after the arrival card hands off to it. */
const LABEL_MS = 7_000;

type Stage = 'closed' | 'form' | 'thanks';

export function FeedbackBar({
  placement,
  layout,
  openSignal = 0,
  lifted = false,
  onOpen
}: {
  placement: PlacementId;
  layout: LayoutId;
  /** Incremented by the arrival card and the footer link to open the pop-up directly. */
  openSignal?: number;
  /**
   * Raises the button above the arrival card's scrim and labels it, so the card can point at a
   * control that is actually lit. Without this the card describes something nobody can see.
   */
  lifted?: boolean;
  /** Fired when the button itself is pressed, so App can dismiss the arrival card first. */
  onOpen?: () => void;
}) {
  const [stage, setStage] = useState<Stage>('closed');
  const [verdict, setVerdict] = useState<'yes' | 'no' | null>(null);
  const [preferred, setPreferred] = useState<LayoutId>(layout);
  const [role, setRole] = useState('');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [showLabel, setShowLabel] = useState(false);

  // A fresh form every time. Without this, reopening after a submission showed the previous
  // answers still filled in, which reads as though the response never sent.
  const openForm = () => {
    setVerdict(null);
    setComment('');
    setPreferred(layout);
    setStage('form');
  };

  // An explicit request opens the pop-up, wherever it came from.
  useEffect(() => {
    if (openSignal > 0) openForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  // While the card is up the button is labelled; when the card closes the label lingers briefly so
  // the eye has somewhere to land, then it settles back to a quiet icon.
  useEffect(() => {
    if (lifted) {
      setShowLabel(true);
      return;
    }
    const timer = window.setTimeout(() => setShowLabel(false), LABEL_MS);
    return () => window.clearTimeout(timer);
  }, [lifted]);

  // Escape closes the pop-up, and the page behind it does not scroll while it is open.
  useEffect(() => {
    if (stage === 'closed') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStage('closed');
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [stage]);

  const submit = async () => {
    if (!verdict) return;
    setSending(true);
    // Analytics first: it is fire-and-forget and must not be lost if the storage call fails.
    trackFeedback(verdict, preferred, placement);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verdict,
          preferredLayout: preferred,
          placement,
          layout,
          role: role || null,
          comment: comment.trim() || null
        })
      });
    } catch {
      // A failed write still counts in analytics, and telling a student their opinion was lost
      // would be worse than silently keeping the count.
    }
    setSending(false);
    setStage('thanks');
  };

  const chip = (active: boolean) =>
    `rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
      active ? 'border-navy bg-navy text-white' : 'border-line bg-white text-ink hover:bg-canvas'
    }`;

  return (
    <>
      {/*
        Rendered unconditionally, outside every stage check. The survey's pop-up covers it with its
        own scrim while open, which is the correct relationship: the button is always there, and
        the thing it opened is simply in front of it.
      */}
      <button
        type="button"
        onClick={() => {
          onOpen?.();
          openForm();
        }}
        aria-label="Give feedback"
        aria-haspopup="dialog"
        className={`group fixed bottom-4 right-4 flex items-center rounded-full bg-navy text-white shadow-lift transition-all hover:bg-navy-600 sm:bottom-6 sm:right-6 ${
          showLabel ? 'gap-2 px-4 py-3' : 'p-3.5 sm:hover:gap-2'
        } ${lifted ? 'z-[75] ring-4 ring-white/80' : 'z-[45] ring-1 ring-white/30'}`}
      >
        <MessageSquarePlus className="h-5 w-5 shrink-0" aria-hidden />
        <span
          className={`overflow-hidden whitespace-nowrap text-sm font-semibold transition-all ${
            showLabel ? 'max-w-[8rem]' : 'max-w-0 sm:group-hover:max-w-[8rem]'
          }`}
        >
          Feedback
        </span>
      </button>

      {stage !== 'closed' && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
        >
          <button
            type="button"
            aria-label="Close feedback"
            onClick={() => setStage('closed')}
            className="absolute inset-0 bg-ink/70 backdrop-blur-[2px]"
          />

          <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-lift">
            {stage === 'form' ? (
              <>
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <h2 id="feedback-title" className="text-lg font-bold leading-tight text-ink">
                      What do you think?
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">
                      Takes about twenty seconds. Only the first question is required.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStage('closed')}
                    aria-label="Close feedback"
                    className="-mr-1 shrink-0 rounded-full p-1.5 text-muted hover:bg-canvas hover:text-ink"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold text-ink">
                      Would you actually use this?
                    </legend>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setVerdict('yes')}
                        aria-pressed={verdict === 'yes'}
                        className={`flex flex-1 items-center justify-center gap-1.5 ${chip(verdict === 'yes')}`}
                      >
                        <ThumbsUp className="h-4 w-4" aria-hidden />
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setVerdict('no')}
                        aria-pressed={verdict === 'no'}
                        className={`flex flex-1 items-center justify-center gap-1.5 ${chip(verdict === 'no')}`}
                      >
                        <ThumbsDown className="h-4 w-4" aria-hidden />
                        No
                      </button>
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold text-ink">
                      Which layout do you prefer?
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {LAYOUTS.map((definition) => (
                        <button
                          key={definition.id}
                          type="button"
                          onClick={() => setPreferred(definition.id)}
                          aria-pressed={preferred === definition.id}
                          className={chip(preferred === definition.id)}
                        >
                          {definition.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold text-ink">You are a…</legend>
                    <div className="flex flex-wrap gap-2">
                      {['BYU student', 'BYU faculty or staff', 'Neither'].map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setRole(option)}
                          aria-pressed={role === option}
                          className={chip(role === option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-ink">
                      Anything missing or broken?
                    </span>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      maxLength={1200}
                      placeholder="What would make you use this instead of what you do now?"
                      className="w-full resize-y rounded-lg border border-line px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                    />
                  </label>

                  <p className="text-[11px] leading-snug text-muted">
                    Anonymous — no name, email or sign-in. Please don&rsquo;t include personal
                    details.
                  </p>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-5 py-3">
                  <p className="text-[11px] leading-snug text-muted">
                    {verdict ? ' ' : 'Pick Yes or No to send.'}
                  </p>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={sending || !verdict}
                    className="shrink-0 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? 'Sending…' : 'Send feedback'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy/10">
                  <Check className="h-6 w-6 text-navy" aria-hidden />
                </span>
                <h2 id="feedback-title" className="text-lg font-bold text-ink">
                  Thank you — that genuinely helps.
                </h2>
                <p className="text-sm leading-relaxed text-muted">
                  Your answer goes straight into the case for building this properly.
                </p>
                <button
                  type="button"
                  onClick={() => setStage('closed')}
                  className="mt-1 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-600"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Footer entry point. The floating button is the primary route; this is for anyone who reads down. */
export function FeedbackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 font-medium text-royal hover:underline"
    >
      <MessageSquare className="h-3.5 w-3.5" aria-hidden />
      Give feedback
    </button>
  );
}
