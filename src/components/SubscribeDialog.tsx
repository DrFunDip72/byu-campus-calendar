import { useState } from 'react';
import { Check, Copy, Download, ExternalLink, Rss, X } from 'lucide-react';
import type { CampusEvent, Filters, ViewId } from '../lib/types';
import { INTEREST_LABELS } from '../lib/data';
import { downloadIcs, subscribeUrl } from '../lib/calendar';
import { filtersToQuery } from '../lib/prefs';
import { trackSubscribe } from '../lib/analytics';

interface Props {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  view: ViewId;
  events: CampusEvent[];
}

/**
 * Turns the current filter set into a live calendar subscription.
 *
 * This is the feature that makes the product sticky rather than a website someone visits twice.
 * A student picks "Football, Dance, Hackathons" once, subscribes, and every new matching event
 * appears in the calendar app they already check — no app to open, no notifications to manage.
 * The same URL is what a department would hand out to its own students.
 */
export function SubscribeDialog({ open, onClose, filters, view, events }: Props) {
  const [copied, setCopied] = useState<'webcal' | 'https' | null>(null);
  if (!open) return null;

  // The feed query deliberately drops the view and the date range: a subscription should track an
  // interest set forever, not freeze on "next 7 days" or remember which layout was open.
  const feedFilters: Filters = { ...filters, range: 'all' };
  const query = filtersToQuery(feedFilters);
  const webcal = subscribeUrl(query, 'webcal');
  const https = subscribeUrl(query, 'https');
  const shareUrl = `${window.location.origin}${window.location.pathname}?${filtersToQuery(filters, view)}`;

  const describe = () => {
    if (!filters.myFeedOnly || filters.interests.length === 0) return 'Every event on campus';
    const names = filters.interests.map((i) => INTEREST_LABELS[i] ?? i);
    if (names.length <= 3) return names.join(', ');
    return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
  };

  const copy = async (value: string, which: 'webcal' | 'https') => {
    try {
      await navigator.clipboard.writeText(value);
      trackSubscribe('copy', filters.interests.length);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard blocked: the input below is selectable as a fallback */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Subscribe to this calendar"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-lift sm:rounded-2xl sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-2 text-muted hover:bg-canvas hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="mb-1 flex items-center gap-2">
          <Rss className="h-4 w-4 text-royal" aria-hidden />
          <h2 className="font-serif text-xl text-ink">Keep this calendar in sync</h2>
        </div>
        <p className="mb-5 text-sm text-muted">
          Subscribe once and new matching events show up automatically. No need to come back here.
        </p>

        <div className="mb-5 rounded-lg border border-line bg-canvas p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            This subscription covers
          </p>
          <p className="text-sm font-medium text-ink">{describe()}</p>
          <p className="mt-0.5 text-xs text-muted">
            {events.length} matching {events.length === 1 ? 'event' : 'events'} right now
            {filters.freeOnly ? ' · free events only' : ''}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <a
            href={webcal}
            onClick={() => trackSubscribe('open', filters.interests.length)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-600"
          >
            Subscribe in my calendar app
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
          <p className="-mt-1 text-xs text-muted">
            Opens Apple Calendar, Outlook or whichever app handles calendar subscriptions on this
            device.
          </p>

          <Field
            label="Google Calendar — paste under “Other calendars → From URL”"
            value={https}
            copied={copied === 'https'}
            onCopy={() => copy(https, 'https')}
          />
          <Field
            label="Direct subscription link (webcal)"
            value={webcal}
            copied={copied === 'webcal'}
            onCopy={() => copy(webcal, 'webcal')}
          />

          <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                downloadIcs(events, 'byu-campus-calendar.ics', `BYU — ${describe()}`);
                trackSubscribe('download', filters.interests.length);
              }}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-canvas"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Download all {events.length} as .ics
            </button>
            <button
              type="button"
              onClick={() => copy(shareUrl, 'https')}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-canvas"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy shareable view
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  copied,
  onCopy
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </label>
      <div className="flex gap-1.5">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2.5 py-2 font-mono text-xs text-ink"
        />
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${label}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-medium text-ink hover:bg-canvas"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
