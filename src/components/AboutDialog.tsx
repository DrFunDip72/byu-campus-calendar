import { CheckCircle2, CircleDashed, ExternalLink, FlaskConical, X } from 'lucide-react';
import { DATA, DEMO_COUNT, REAL_COUNT } from '../lib/data';
import { LAYOUTS, PLACEMENTS } from '../lib/views';

/**
 * The honesty panel.
 *
 * This project is a pitch, and the fastest way to lose a pitch is to let a reviewer discover a gap
 * themselves. So the coverage gaps are stated here, in the product, next to what *is* working: the
 * BYU calendar API is wired up and live, club-level sources are not, and anyone clicking the info
 * icon learns that in ten seconds rather than by noticing their club is missing.
 */
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const updated = new Date(DATA.generatedAt);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="About the BYU Campus Calendar"
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-lift sm:rounded-2xl sm:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-2 text-muted hover:bg-canvas hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <h2 className="mb-1 font-serif text-2xl text-ink">One calendar for all of campus</h2>
        <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
          Events at BYU are spread across the main calendar, individual college and department
          sites, and club pages. A student who wants to know when the football game, the dance, and
          their association meeting are has to check three places and will miss one. This is the
          proposal for a single place to check instead.
        </p>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Two choices, nine combinations, one dataset
          </h3>
          <p className="mb-3 max-w-prose text-sm text-muted">
            Navigation is two questions rather than a row of tabs, because they are genuinely
            different questions:{' '}
            <span className="font-semibold text-ink">where this would live</span> is a decision for
            BYU, and <span className="font-semibold text-ink">how events are laid out</span> is a
            decision for students. The data, search, filters and calendar export are identical in
            all nine combinations, so choosing between them is never a choice about features.
          </p>
          <div className="flex flex-col gap-4">
            <div>
              <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-navy-400">
                Where this lives
              </h4>
              <ul className="flex flex-col gap-2">
                {PLACEMENTS.map((definition) => {
                  const Icon = definition.icon;
                  return (
                    <li key={definition.id} className="flex items-start gap-2.5 text-sm">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" aria-hidden />
                      <span>
                        <span className="font-semibold text-ink">{definition.title}</span>
                        <span className="text-muted"> — {definition.blurb}.</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-navy-400">
                Layout
              </h4>
              <ul className="flex flex-col gap-2">
                {LAYOUTS.map((definition) => {
                  const Icon = definition.icon;
                  return (
                    <li key={definition.id} className="flex items-start gap-2.5 text-sm">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" aria-hidden />
                      <span>
                        <span className="font-semibold text-ink">{definition.label}</span>
                        <span className="text-muted"> — {definition.blurb}.</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Today&rsquo;s BYU app shows a single day at a time, which is the gap the proposal is
                built around. That original behaviour stays viewable at{' '}
                <code className="rounded bg-canvas px-1">?mode=day</code> on the BYU App placement,
                for a before-and-after comparison.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Where this data comes from
          </h3>
          <ul className="mb-3 flex flex-col gap-2">
            {DATA.sources.map((source) => (
              <li key={source.id} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                <span>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-royal hover:underline"
                  >
                    {source.label}
                    <ExternalLink className="ml-1 inline h-3 w-3" aria-hidden />
                  </a>
                  <span className="text-muted"> — {source.count} records pulled. Live.</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-muted">
            <span className="font-semibold text-ink">{REAL_COUNT} real events</span> after
            de-duplication, covering {DATA.windowDays} days, plus {DEMO_COUNT} stand-ins described
            below.
            We request <code className="rounded bg-canvas px-1">categories=all</code>, which reaches
            events whose primary category is a department (School of Music, BRAVO! Events, Academic
            Calendar) and which the nine main category ids silently miss. Times are America/Denver.
            Last refreshed{' '}
            {updated.toLocaleString('en-US', { timeZone: 'America/Denver', dateStyle: 'medium', timeStyle: 'short' })} MT,
            and the snapshot re-pulls daily.
          </p>
        </section>

        <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50/60 p-3.5">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-900">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden />
            The {DEMO_COUNT} events marked DEMO
          </h3>
          <p className="max-w-prose text-sm leading-relaxed text-amber-900">
            Every event badged <span className="font-semibold">DEMO</span> is an illustrative
            stand-in, not a real BYU record. They exist because of a genuine chicken-and-egg
            problem: BYU&rsquo;s public feed carries{' '}
            <span className="font-semibold">zero hackathons, zero conferences</span> and a single
            undifferentiated bucket of club events with no way to follow a named association — so
            the headline feature here, following the things you actually care about, had almost
            nothing real to act on. Adding nothing would have made the feature look pointless;
            adding these quietly would have overstated the data. So they are present, labelled, and
            excluded from the {REAL_COUNT} figure above. The clubs they represent are ones
            BYU&rsquo;s own app already lists.
          </p>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            What is not covered yet
          </h3>
          <ul className="flex flex-col gap-2">
            {[
              [
                'Club and association events',
                `The public calendar API has no vocabulary for them. Across all ${REAL_COUNT} real records there are zero hackathons and no way to follow a named association — “clubs” is one flat bucket of about 15 events. But BYU’s own mobile app does show them, with a dedicated Club field: Marketing Association, Pre-Nursing Association, Cybersecurity Students Academic Association, Investment Banking Association. So the data already exists inside BYU; it is simply not on the public endpoint this reads. The ask is not “get clubs to publish” — it is read access to the feed BYU’s own app already uses.`
              ],
              [
                'Most college and department calendars',
                'Only 11 organizations publish a usable host name to the calendar API. The CS department is wired up as a proof that per-department sources merge cleanly; the other colleges each need the same treatment.'
              ],
              [
                'Intramurals and Y-Serve',
                'Separate systems with their own schedules.'
              ],
              [
                'Personal class schedule',
                'A BYU sign-in would let the calendar hide events that collide with a student’s classes, which is the single highest-value addition on this list.'
              ]
            ].map(([title, detail]) => (
              <li key={title} className="flex items-start gap-2.5 text-sm">
                <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                <span>
                  <span className="font-semibold text-ink">{title}</span>
                  <span className="text-muted"> — {detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Status
          </h3>
          <p className="max-w-prose text-sm leading-relaxed text-muted">
            A student-built proposal, not an official BYU product. Event data belongs to BYU and
            links back to the official pages. Built to be handed over: the ingest is one script, the
            taxonomy is one file, and adding a source means writing one function.
          </p>
        </section>
      </div>
    </div>
  );
}
