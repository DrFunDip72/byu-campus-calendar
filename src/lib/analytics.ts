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
 * The events here are chosen to answer the questions actually worth asking:
 *
 *   placement_change Where would people put this? The pitch question.
 *   layout_change    Which layout do students prefer? The design question.
 *   add_to_calendar  Did anyone act on an event? The core conversion.
 *   subscribe        Did anyone want the feed permanently? The stickiness signal.
 *   follow_interest  Is the interest model the right idea, and which interests win?
 *   feedback         Someone answered the in-page survey. Mirrors the Blob write, so a tally
 *                    survives even if the storage call fails.
 *   compare_open     Someone opened the side-by-side comparison.
 *
 * `placement_change` and `layout_change` replaced a single `view_change` when navigation split
 * into two axes. Collapsing both axes into one event would have made the two most interesting
 * numbers — preferred placement and preferred layout — impossible to separate in the dashboard.
 *
 * Nothing identifying is sent — no user id, no search text, no event titles. Interest, placement
 * and layout ids are fixed vocabulary from our own code, not user input. The feedback event sends
 * only the vote and which surface it came from, never the free-text comment.
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

/** Which placement someone switched to, and how they got there. */
export const trackPlacementChange = (placement: string, via: 'switcher' | 'sheet' | 'compare') =>
  track('placement_change', { placement, via });

/** Which layout someone switched to. The single most useful design signal this project collects. */
export const trackLayoutChange = (layout: string, placement: string, via: 'switcher' | 'sheet' | 'compare') =>
  track('layout_change', { layout, placement, via });

/** Someone pushed an event to their own calendar. `target` is google | outlook | ics. */
export const trackAddToCalendar = (target: string, view: string) =>
  track('add_to_calendar', { target, view });

/** Someone opened or copied the live subscription feed. */
export const trackSubscribe = (action: 'open' | 'copy' | 'download', interests: number) =>
  track('subscribe', { action, interests });

/** Someone followed an interest. The id tells us which interests students actually want. */
export const trackFollowInterest = (interest: string) => track('follow_interest', { interest });

/**
 * The in-page survey was submitted.
 *
 * Deliberately duplicated with the Blob write in /api/feedback: analytics gives a reliable count
 * even if the storage call fails, and storage gives the written comments that a count cannot.
 * Neither alone is enough.
 */
export const trackFeedback = (
  verdict: 'yes' | 'no',
  preferredLayout: string,
  placement: string
) => track('feedback', { verdict, preferredLayout, placement });

/** The side-by-side comparison was opened. */
export const trackCompareOpen = (from: string) => track('compare_open', { from });
