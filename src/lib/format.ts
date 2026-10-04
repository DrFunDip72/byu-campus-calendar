import type { CampusEvent } from './types';

/**
 * Every date in this app is formatted in America/Denver, never in the viewer's zone. A student on
 * an internship in New York checking when the game starts needs the Provo clock time, because that
 * is the time printed on the ticket.
 */
const DENVER = 'America/Denver';

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { timeZone: DENVER, ...options });

const timeFmt = fmt({ hour: 'numeric', minute: '2-digit' });
const dayFmt = fmt({ weekday: 'long', month: 'long', day: 'numeric' });
const shortDayFmt = fmt({ weekday: 'short', month: 'short', day: 'numeric' });
const monthFmt = fmt({ month: 'long', year: 'numeric' });
const weekdayFmt = fmt({ weekday: 'short' });
const dateNumFmt = fmt({ day: 'numeric' });
const fullFmt = fmt({ weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "7:30 PM" -> "7:30 PM"; drops the ":00" on the hour so a dense list reads as "7 PM". */
export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso)).replace(':00', '');
}

export function formatTimeRange(event: CampusEvent): string {
  if (event.allDay) return 'All day';
  const start = formatTime(event.start);
  if (!event.end) return start;
  const end = formatTime(event.end);
  return end === start ? start : `${start} – ${end}`;
}

export const formatDay = (date: Date | string) => dayFmt.format(new Date(date));
export const formatShortDay = (date: Date | string) => shortDayFmt.format(new Date(date));
export const formatMonth = (date: Date | string) => monthFmt.format(new Date(date));
export const formatWeekday = (date: Date | string) => weekdayFmt.format(new Date(date));
export const formatDateNum = (date: Date | string) => dateNumFmt.format(new Date(date));
export const formatFull = (date: Date | string) => fullFmt.format(new Date(date));

/** Denver-local y/m/d key, so day grouping does not shift for a viewer in another zone. */
export function dayKey(date: Date | string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DENVER,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(date));
  return parts;
}

/** "Today", "Tomorrow", or the weekday — the heading a student actually scans for. */
export function relativeDayLabel(date: Date, now = new Date()): string {
  const target = dayKey(date);
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000));
  if (target === today) return 'Today';
  if (target === tomorrow) return 'Tomorrow';
  return formatDay(date);
}

export function formatPrice(event: CampusEvent): string | null {
  if (event.free) return 'Free';
  if (event.priceHigh > 0) {
    return event.priceLow > 0 && event.priceLow !== event.priceHigh
      ? `$${event.priceLow}–$${event.priceHigh}`
      : `$${event.priceHigh}`;
  }
  if (event.ticketsUrl) return 'Ticketed';
  return null;
}

/** First sentence or so of a description, for a card subtitle. */
export function excerpt(event: CampusEvent, max = 150): string {
  const text = (event.summary ?? event.description ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : max)}…`;
}
