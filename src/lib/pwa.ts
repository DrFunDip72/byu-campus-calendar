/**
 * Service worker registration.
 *
 * This file used to hold install-prompt support as well — `beforeinstallprompt` capture for
 * Chrome, hand-written "Share → Add to Home Screen" instructions for iOS Safari, and the
 * dismissal bookkeeping around both. All of it has been removed on purpose.
 *
 * BYU already ships a mobile app, and one of this project's three placements is a proposal for
 * that app's calendar tab. Prompting a student to install a second, student-built app alongside it
 * argues against the pitch: the goal is for this to become part of BYU's products, not to compete
 * with them for a home-screen slot.
 *
 * What stays is the offline service worker, because that is free and genuinely useful — campus
 * wifi is unreliable, and a cached shell means a student who opens the calendar in a building with
 * bad signal still sees their events. `/feed.ics` is explicitly never cached, since a stale
 * calendar subscription would silently stop updating. See public/sw.js.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration failures are not worth surfacing: the app works fine without offline support */
    });
  });
}
