import { useEffect, useState } from 'react';
import { Check, MessageSquare, MessageSquarePlus, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { LAYOUTS } from '../lib/views';
import { trackFeedback } from '../lib/analytics';
import type { LayoutId, PlacementId } from '../lib/types';

/**
 * The feedback button and the survey it opens.
 *
 * "Tell me what you think" on a social post gets you five comments from people who already like
 * you. Asking inside the product, at the moment someone has just used it, gets a number — and a
 * number is what a pitch needs: "64% of 71 students picked the list layout" is an argument, where
 * "people seemed to like it" is not.
 *
 * The first version appeared on a 25-second timer and was otherwise reachable only through a text
 * link in the footer. That made the feedback route invisible to anyone who looked around briefly
 * and left, and an interruption to anyone who stayed. It now works the other way round: nothing
 * appears unasked, and a button is permanently parked in the bottom-right corner of every
 * placement and every layout. The arrival card introduces it once (see WelcomeCard), so it is a
 * control students have been shown rather than one they have to notice.
 *
 * The button and the panel are deliberately one component with one state machine. They share a
 * corner and must never both be on screen, and the arrangement they replace — a timer in here, an
 * open-signal counter in App — is the same two-controls-one-state shape that put the layout
 * switchers out of sync.
 *
 * Two constraints kept from the first version:
 *
 *   - It asks one question first. A form with four fields up front gets abandoned; a single
 *     thumbs-up/down costs nothing and earns the right to ask the rest.
 *   - It collects nothing identifying, and says so where the comment box is. Students writing
 *     feedback about their own university should not have to wonder.
 *
 * Submission is doubly recorded on purpose — Blob storage for the written comments, an analytics
 * event for the count — because the count must survive a storage failure, and the comments cannot
 * be reconstructed from a count. See lib/analytics.ts and api/feedback.ts.
 */

/** How long the button keeps its label after the arrival card hands off to it. */
const LABEL_MS = 7_000;

type Stage = 'hidden' | 'prompt' | 'form' | 'thanks';

export function FeedbackBar({
  placement,
  layout,
  openSignal = 0,
  lifted = false,
  onOpen
}: {
  placement: PlacementId;
  layout: LayoutId;
  /** Incremented by the arrival card and the footer link to open the survey directly. */
  openSignal?: number;
  /**
   * Raises the button above the arrival card's scrim and labels it, so the card can point at a
   * control that is actually lit. Without this the card describes something nobody can see.
   */
  lifted?: boolean;
  /** Fired when the button itself is pressed, so App can dismiss the arrival card first. */
  onOpen?: () => void;
}) {
  const [stage, setStage] = useState<Stage>('hidden');
  const [verdict, setVerdict] = useState<'yes' | 'no' | null>(null);
  const [preferred, setPreferred] = useState<LayoutId>(layout);
  const [role, setRole] = useState('');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [showLabel, setShowLabel] = useState(false);

  // An explicit request opens the survey, wherever it came from.
  useEffect(() => {
    if (openSignal > 0) setStage('prompt');
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

  const begin = (value: 'yes' | 'no') => {
    setVerdict(value);
    setStage('form');
  };

  const submit = async () => {
    setSending(true);
    // Analytics first: it is fire-and-forget and must not be lost if the storage call fails.
    trackFeedback(verdict ?? 'yes', preferred, placement);
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
    window.setTimeout(() => setStage('hidden'), 4000);
  };

  // The resting state: the button, and nothing else. It is never suppressed by a stored dismissal —
  // someone who closed the survey last week may well have something to say today.
  if (stage === 'hidden') {
    // The flex gap is conditional along with the padding: a gap still occupies space next to a
    // zero-width label, which left the collapsed button 8px wider than it was tall.
    return (
      <button
        type="button"
        onClick={() => {
          onOpen?.();
          setStage('prompt');
        }}
        aria-label="Give feedback"
        className={`group fixed bottom-4 right-4 flex items-center rounded-full bg-navy text-white shadow-lift transition-all hover:bg-navy-600 sm:bottom-6 sm:right-6 ${
          showLabel ? 'gap-2 px-4 py-3' : 'p-3.5 sm:hover:gap-2'
        } ${lifted ? 'z-[75] ring-4 ring-white/80' : 'z-40 ring-1 ring-white/30'}`}
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
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 sm:px-6 sm:pb-5">
      <div className="w-full max-w-xl rounded-xl border border-line bg-white p-3 shadow-lift sm:p-4">
        {stage === 'prompt' && (
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-sm font-semibold text-ink">
              Would you actually use this?
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => begin('yes')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-navy-600"
              >
                <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                Yes
              </button>
              <button
                type="button"
                onClick={() => begin('no')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink hover:bg-canvas"
              >
                <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
                No
              </button>
              <button
                type="button"
                onClick={() => setStage('hidden')}
                aria-label="Close feedback"
                className="rounded-full p-1.5 text-muted hover:bg-canvas hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        )}

        {stage === 'form' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-ink">
                {verdict === 'yes' ? 'Great — two quick things.' : 'Noted. What would change that?'}
              </p>
              <button
                type="button"
                onClick={() => setStage('hidden')}
                aria-label="Close feedback"
                className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-muted hover:bg-canvas hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-navy-400">
                Which layout do you prefer?
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {LAYOUTS.map((definition) => (
                  <button
                    key={definition.id}
                    type="button"
                    onClick={() => setPreferred(definition.id)}
                    aria-pressed={preferred === definition.id}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      preferred === definition.id
                        ? 'border-navy bg-navy text-white'
                        : 'border-line bg-white text-ink hover:bg-canvas'
                    }`}
                  >
                    {definition.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-navy-400">
                You are a…
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {['BYU student', 'BYU faculty or staff', 'Neither'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRole(option)}
                    aria-pressed={role === option}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      role === option
                        ? 'border-navy bg-navy text-white'
                        : 'border-line bg-white text-ink hover:bg-canvas'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-navy-400">
                Anything missing or broken? (optional)
              </span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                maxLength={1200}
                placeholder="What would make you use this instead of what you do now?"
                className="w-full resize-y rounded-lg border border-line px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </label>

            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] leading-snug text-muted">
                Anonymous — no name, email or sign-in. Please don&rsquo;t include personal details.
              </p>
              <button
                type="button"
                onClick={submit}
                disabled={sending}
                className="shrink-0 rounded-lg bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-navy-600 disabled:opacity-60"
              >
                {sending ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </div>
        )}

        {stage === 'thanks' && (
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Check className="h-4 w-4 text-navy" aria-hidden />
            Thank you — that genuinely helps.
          </p>
        )}
      </div>
    </div>
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
