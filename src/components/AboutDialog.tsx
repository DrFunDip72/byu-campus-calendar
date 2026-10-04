import { CheckCircle2, CircleDashed, ExternalLink, X } from 'lucide-react';
import { DATA } from '../lib/data';
import { VIEWS, VIEW_GROUPS, viewsInGroup } from '../lib/views';

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
            {VIEWS.length} views, one dataset
          </h3>
          <p className="mb-3 max-w-prose text-sm text-muted">
            Switch between them in the bar at the top. The data, search, filters and calendar export
            are identical in every one — only the presentation changes, so a decision between them is
            a decision about students, not about features.
          </p>
          <div className="flex flex-col gap-4">
            {VIEW_GROUPS.map((group) => (
              <div key={group.id}>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-navy-400">
                  {group.label}
                </h4>
                <ul className="flex flex-col gap-2">
                  {viewsInGroup(group.id).map((definition) => {
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
            ))}
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
            {DATA.events.length} unique events after de-duplication, covering {DATA.windowDays} days.
            We request <code className="rounded bg-canvas px-1">categories=all</code>, which reaches
            events whose primary category is a department (School of Music, BRAVO! Events, Academic
            Calendar) and which the nine main category ids silently miss. Times are America/Denver.
            Last refreshed{' '}
            {updated.toLocaleString('en-US', { timeZone: 'America/Denver', dateStyle: 'medium', timeStyle: 'short' })} MT,
            and the snapshot re-pulls daily.
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
                'The public calendar API does not carry them: zero matches for hackathons or the Product Management Association across all 626 records in 365 days. But BYU’s own mobile app does show them — Marketing Association, Pre-Nursing Association, Investment Banking Association — so the data exists inside BYU, just not on the public endpoint this reads. Connecting that one feed closes the single biggest gap here.'
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
