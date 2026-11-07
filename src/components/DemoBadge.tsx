import type { CampusEvent } from '../lib/types';

/**
 * The DEMO marker, rendered inline next to an event's title.
 *
 * It sits on the card rather than only in the About panel because the stand-ins appear in the
 * first screenful of results. A disclosure a reader has to go looking for is not a disclosure —
 * anyone glancing at a single card should be able to tell whether they are looking at a real BYU
 * record. See scripts/seed-demo.mjs for why the stand-ins exist at all.
 *
 * Returns null for real events, so call sites need no conditional of their own.
 */
export function DemoBadge({ event, tone = 'light' }: { event: CampusEvent; tone?: 'light' | 'dark' }) {
  if (!event.demo) return null;

  return (
    <span
      title="An illustrative stand-in, not a real BYU event"
      className={`ml-1.5 inline-flex shrink-0 translate-y-[-1px] items-center rounded px-1 py-px align-middle text-[9px] font-bold uppercase tracking-wide ${
        tone === 'dark' ? 'bg-amber-400/90 text-amber-950' : 'bg-amber-100 text-amber-900'
      }`}
    >
      Demo
    </span>
  );
}
