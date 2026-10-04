import type { CampusEvent } from './types';

/**
 * Getting an event onto a student's own calendar, three ways:
 *
 *   1. Google Calendar — a prefilled "add event" URL. Covers most students in one click.
 *   2. Outlook Web — the same, for anyone on the BYU Microsoft tenant.
 *   3. An .ics download — Apple Calendar, Outlook desktop, and everything else.
 *
 * Plus `subscribeUrl` below, which turns the *current filters* into a live subscription so new
 * matching events keep arriving without the student coming back. That is the one that matters: a
 * one-off "add to calendar" is a convenience, a subscription is a habit.
 */

/** 2026-10-09T20:15:00-06:00 -> 20261010T021500Z */
const utcStamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** All-day events use a date-only value, which is what makes them render as all-day and not midnight. */
const dayStamp = (date: Date) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

export function eventEnd(event: CampusEvent): Date {
  if (event.end) return new Date(event.end);
  const start = new Date(event.start);
  return new Date(start.getTime() + 60 * 60 * 1000);
}

/** The text block shown in the student's own calendar entry. */
function details(event: CampusEvent): string {
  const parts: string[] = [];
  if (event.summary) parts.push(event.summary);
  else if (event.description) parts.push(event.description.slice(0, 600));
  if (event.orgs.length) parts.push(`Hosted by: ${event.orgs.join(', ')}`);
  if (event.ticketsUrl) parts.push(`Tickets: ${event.ticketsUrl}`);
  if (event.url) parts.push(`Details: ${event.url}`);
  parts.push('Added from the BYU Campus Calendar.');
  return parts.join('\n\n');
}

export function googleCalendarUrl(event: CampusEvent): string {
  const start = new Date(event.start);
  const end = eventEnd(event);
  const dates = event.allDay
    ? `${dayStamp(start)}/${dayStamp(new Date(start.getTime() + 86_400_000))}`
    : `${utcStamp(start)}/${utcStamp(end)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates,
    details: details(event),
    location: event.location ?? 'BYU Campus, Provo, UT',
    ctz: 'America/Denver'
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(event: CampusEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: new Date(event.start).toISOString(),
    enddt: eventEnd(event).toISOString(),
    body: details(event),
    location: event.location ?? 'BYU Campus, Provo, UT'
  });
  if (event.allDay) params.set('allday', 'true');
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/** RFC 5545 TEXT escaping. */
const escapeText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n|\r/g, '\\n');

/** Folds a content line at 75 characters (RFC 5545 3.1); continuations start with one space. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join('\r\n');
}

export function toVevent(event: CampusEvent): string[] {
  const start = new Date(event.start);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.id.replace(/[^\w:.-]/g, '-')}@byu-campus-calendar`,
    `DTSTAMP:${utcStamp(new Date())}`,
    event.allDay ? `DTSTART;VALUE=DATE:${dayStamp(start)}` : `DTSTART:${utcStamp(start)}`,
    event.allDay
      ? `DTEND;VALUE=DATE:${dayStamp(new Date(start.getTime() + 86_400_000))}`
      : `DTEND:${utcStamp(eventEnd(event))}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(details(event))}`,
    `CATEGORIES:${escapeText(event.category)}`
  ];
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push('END:VEVENT');
  return lines.map(fold);
}

export function buildIcs(events: CampusEvent[], calendarName: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BYU Campus Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    'X-WR-TIMEZONE:America/Denver',
    // Tells subscribing clients not to hammer the endpoint; the snapshot changes once a day.
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    ...events.flatMap(toVevent),
    'END:VCALENDAR'
  ];
  return `${lines.join('\r\n')}\r\n`;
}

/** Triggers a .ics download in the browser, for Apple Calendar and Outlook desktop. */
export function downloadIcs(events: CampusEvent[], filename: string, calendarName: string) {
  const blob = new Blob([buildIcs(events, calendarName)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick: Safari needs the object URL to survive the click handler.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * The live subscription URL for the current filters. `webcal://` is what makes Google Calendar,
 * Apple Calendar and Outlook all offer to *subscribe* rather than download a one-time copy.
 */
export function subscribeUrl(query: string, protocol: 'webcal' | 'https' = 'webcal'): string {
  const host = window.location.host;
  const base = `${protocol}://${host}/feed.ics`;
  return query ? `${base}?${query}` : base;
}
