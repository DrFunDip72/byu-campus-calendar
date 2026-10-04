import { Download, Share, SquarePlus, X } from 'lucide-react';
import { useInstallPrompt } from '../lib/pwa';

/**
 * The "add to home screen" banner.
 *
 * Sits above the bottom of the viewport rather than the top: on a phone the top of the screen is
 * where the student is reading, and a banner there covers the thing they opened the app for.
 * Dismissal is remembered for 30 days (see lib/pwa.ts) so this is an offer, not a nag.
 */
export function InstallPrompt() {
  const { mode, install, dismiss } = useInstallPrompt();
  if (mode === 'none') return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-white/10 bg-byu-navy p-3.5 shadow-lift">
        <img
          src="/icons/icon-192.png"
          alt=""
          className="h-11 w-11 shrink-0 rounded-lg"
          width={44}
          height={44}
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-white">
            Add BYU Events to your home screen
          </p>

          {mode === 'prompt' ? (
            <>
              <p className="mt-0.5 text-xs leading-snug text-byu-sky">
                Opens full screen and works without signal.
              </p>
              <button
                type="button"
                onClick={install}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-byu-navy hover:bg-byu-sky"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Install
              </button>
            </>
          ) : (
            // iOS has no install API, so the only honest thing to do is name the two taps.
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-snug text-byu-sky">
              Tap
              <Share className="inline h-3.5 w-3.5 shrink-0" aria-label="the Share button" />
              then
              <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-white">
                <SquarePlus className="h-3.5 w-3.5" aria-hidden />
                Add to Home Screen
              </span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-byu-sky hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
