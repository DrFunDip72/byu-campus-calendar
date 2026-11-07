import { useEffect, useState } from 'react';
import { Check, MessageSquare, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { LAYOUTS } from '../lib/views';
import { trackFeedback } from '../lib/analytics';
import type { LayoutId, PlacementId } from '../lib/types';

/**
 * The in-page survey.
 *
 * "Tell me what you think" on a social post gets you five comments from people who already like
 * you. Asking inside the product, at the moment someone has just used it, gets a number — and a
 * number is what a pitch needs: "64% of 71 students picked the list layout" is an argument, where
 * "people seemed to like it" is not.
 *
 * Three deliberate constraints:
 *
 *   - It asks one question first. A form with four fields up front gets abandoned; a single
 *     thumbs-up/down costs nothing and earns the right to ask the rest.
 *   - It never nags. Dismissing or submitting is remembered locally and it does not come back.
 *   - It collects nothing identifying, and says so where the comment box is. Students writing
 *     feedback about their own university should not have to wonder.
 *
 * Submission is doubly recorded on purpose — Blob storage for the written comments, an analytics
 * event for the count — because the count must survive a storage failure, and the comments cannot
 * be reconstructed from a count. See lib/analytics.ts and api/feedback.ts.
 */

const STORAGE_KEY = 'byu-campus-calendar.feedback.v1';

/** Long enough that the prompt arrives after someone has actually looked at events, not before. */
const APPEAR_AFTER_MS = 25_000;

type Stage = 'hidden' | 'prompt' | 'form' | 'thanks';

export function FeedbackBar({
  placement,
  layout,
  openSignal = 0
}: {
  placement: PlacementId;
  layout: LayoutId;
  /** Incremented by the footer link, so someone who dismissed the bar can still volunteer later. */
  openSignal?: number;
}) {
  const [stage, setStage] = useState<Stage>('hidden');
  const [verdict, setVerdict] = useState<'yes' | 'no' | null>(null);
  const [preferred, setPreferred] = useState<LayoutId>(layout);
  const [role, setRole] = useState('');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let done = false;
    try {
      done = localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      /* private browsing: show it, and simply fail to remember the dismissal */
    }
    if (done) return;
    const timer = window.setTimeout(() => setStage('prompt'), APPEAR_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // An explicit request beats both the timer and a remembered dismissal.
  useEffect(() => {
    if (openSignal > 0) setStage('prompt');
  }, [openSignal]);

  const remember = (value: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* nothing to do: the bar reappears next visit, which is an acceptable failure */
    }
  };

  const dismiss = () => {
    remember('dismissed');
    setStage('hidden');
  };

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
    remember('submitted');
    setSending(false);
    setStage('thanks');
    window.setTimeout(() => setStage('hidden'), 4000);
  };

  if (stage === 'hidden') return null;

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
                onClick={dismiss}
                aria-label="Dismiss feedback request"
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
                onClick={dismiss}
                aria-label="Dismiss feedback request"
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

/** Footer entry point, for someone who dismissed the bar and changed their mind. */
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
