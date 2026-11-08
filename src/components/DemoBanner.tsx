import { useState } from 'react';
import { Info, X } from 'lucide-react';
import { DEMO_COUNT, REAL_COUNT } from '../lib/data';

/**
 * The honesty banner.
 *
 * Shown on every placement rather than tucked inside the About panel, because the stand-in events
 * are visible on the first screen and a label that has to be hunted for is not a label. It also
 * doubles as the pitch: the reason stand-ins are needed at all *is* the finding.
 *
 * It is dismissable, and the dismissal sticks. That is safe to offer because the banner is the
 * *summary* of the disclosure, not the disclosure itself — every stand-in still carries a DEMO
 * badge wherever it appears, month chips keep their dotted outline, the exported .ics still
 * prefixes `[DEMO]`, and the About dialog still explains the whole thing. Nothing about whether an
 * event is real depends on this strip being on screen, so a reader who has absorbed it once should
 * be able to reclaim the space — particularly on a phone, where it costs two lines above the fold
 * on every single page.
 *
 * It owns its own dismissal rather than taking it as a prop. The state has exactly one consumer,
 * and threading it through App would make the three placement branches each pass something they do
 * not otherwise care about.
 */

const STORAGE_KEY = 'byu-campus-calendar.demo-banner.v1';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    // Private browsing: show it. Read in the initializer rather than an effect so a returning
    // visitor never sees it flash in and out on load.
    return false;
  }
}

export function DemoBanner({ onExplain }: { onExplain: () => void }) {
  const [dismissed, setDismissed] = useState(readDismissed);

  if (DEMO_COUNT === 0 || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* it returns next visit, which is a tolerable failure */
    }
    setDismissed(true);
  };

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-[1200px] items-start gap-2 px-4 py-2 sm:px-6">
        <Info className="mt-[3px] h-3.5 w-3.5 shrink-0 text-amber-900" aria-hidden />
        <p className="min-w-0 flex-1 text-[11px] leading-snug text-amber-900 sm:text-xs">
          <span className="font-semibold">{REAL_COUNT} real BYU events</span> pulled from the public
          calendar API, plus <span className="font-semibold">{DEMO_COUNT} stand-ins marked DEMO</span>{' '}
          — because that feed has no category for clubs, hackathons or any specific student
          association.{' '}
          <button
            type="button"
            onClick={onExplain}
            className="font-semibold underline hover:no-underline"
          >
            Why that matters
          </button>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss the stand-in data notice"
          title="Dismiss"
          /* Negative margins absorb the padding rather than adding to it, so the touch target is
             34px on a phone while the banner stays as short as the text that sets its height. */
          className="-my-2.5 -mr-2 shrink-0 rounded-full p-2.5 text-amber-800 transition-colors hover:bg-amber-200/70 hover:text-amber-950 sm:-my-1 sm:-mr-1.5 sm:p-1.5"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
