import { useEffect, useState } from 'react';
import { trackInstall } from './analytics';

/**
 * PWA install support.
 *
 * Two platforms, two completely different mechanisms:
 *
 *   - Chrome / Edge / Samsung Internet fire `beforeinstallprompt`, which we capture and replay when
 *     the student taps our own button. The browser only fires it when the app is installable
 *     (manifest + service worker + served over HTTPS), so the presence of the event is itself the
 *     signal that we are allowed to offer installation.
 *   - iOS Safari has no such event. Installing is "Share → Add to Home Screen", done by hand, so
 *     the only thing we can do is detect iOS Safari and show those instructions.
 *
 * Both paths are suppressed once the app is already running standalone.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'byu-campus-calendar.install-dismissed';
/** How long a dismissal sticks. Long enough not to nag, short enough to re-offer next semester. */
const DISMISS_DAYS = 30;

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari exposes standalone mode on navigator instead of via a media query.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // Chrome and Firefox on iOS cannot install either, and their UA contains CriOS / FxiOS.
  return isIos && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export type InstallMode = 'none' | 'prompt' | 'ios';

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<InstallMode>('none');

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onBeforeInstall = (event: Event) => {
      // Chrome shows its own mini-infobar unless this is prevented; we want our own, BYU-styled one.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setMode('prompt');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    const onInstalled = () => {
      setMode('none');
      setDeferred(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    // iOS gets the manual instructions, but only on a phone-sized screen — "add to home screen" is
    // meaningless advice on a desktop browser.
    if (isIosSafari() && window.matchMedia('(max-width: 820px)').matches) {
      // Delayed so it does not cover the first thing a student sees.
      const timer = setTimeout(() => {
        setMode('ios');
        // iOS cannot report an install, so the best available signal is that we showed the how-to.
        trackInstall('ios_shown');
      }, 2500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
        window.removeEventListener('appinstalled', onInstalled);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') trackInstall('accepted');
    // The event can only be used once; Chrome re-fires it later if the student declines.
    setDeferred(null);
    setMode('none');
    if (outcome === 'dismissed') dismiss();
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage unavailable: the banner simply reappears next visit */
    }
    setMode('none');
  };

  return { mode, install, dismiss };
}

/** Registers the service worker. No-op in dev, where it would cache a stale shell between reloads. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration failures are not worth surfacing: the app works fine without offline support */
    });
  });
}
