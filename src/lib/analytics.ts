import { track as vercelTrack } from '@vercel/analytics';

/**
 * Usage tracking, via Vercel Web Analytics.
 *
 * Why this and not Google Analytics / Plausible / Fathom:
 *   - It is already part of the hosting. One package, one component, one dashboard toggle.
 *   - It sets **no cookies** and stores no personal data, so there is no consent banner to build —
 *     which matters for something being pitched to a university.
 *   - Free on the current plan.
 *
 * Page views are collected automatically by the <Analytics /> component. Everything below is a
 * *custom event*, and the set is deliberately small for two reasons: the free tier caps events per
 * month, and a dashboard with forty event types answers no question at all.
 *
 * The five events here are chosen to answer the questions actually worth asking:
 *
 *   view_change      Which surface do people use? The whole pitch rests on this.
 *   add_to_calendar  Did anyone act on an event? The core conversion.
 *   subscribe        Did anyone want the feed permanently? The stickiness signal.
 *   follow_interest  Is the interest model the right idea, and which interests win?
 *   install_pwa      How many people put it on a home screen?
 *
 * Nothing identifying is sent — no user id, no search text, no event titles. Interest ids and
 * view ids are fixed vocabulary from our own code, not user input.
 */

/** Dev builds and server-rendering must not emit events. */
const enabled = () => typeof window !== 'undefined' && !import.meta.env.DEV;

type Props = Record<string, string | number | boolean | null>;

function track(name: string, props?: Props) {
  if (!enabled()) return;
  try {
    vercelTrack(name, props);
  } catch {
    /* analytics must never break the page */
  }
}

/** Which of the five surfaces someone switched to, and how they got there. */
export const trackViewChange = (view: string, via: 'switcher' | 'sheet') =>
  track('view_change', { view, via });

/** Someone pushed an event to their own calendar. `target` is google | outlook | ics. */
export const trackAddToCalendar = (target: string, view: string) =>
  track('add_to_calendar', { target, view });

/** Someone opened or copied the live subscription feed. */
export const trackSubscribe = (action: 'open' | 'copy' | 'download', interests: number) =>
  track('subscribe', { action, interests });

/** Someone followed an interest. The id tells us which interests students actually want. */
export const trackFollowInterest = (interest: string) => track('follow_interest', { interest });

/** Home-screen install completed, or the iOS instructions were shown. */
export const trackInstall = (outcome: 'accepted' | 'ios_shown') => track('install_pwa', { outcome });
