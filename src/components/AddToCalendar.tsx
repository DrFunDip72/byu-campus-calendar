import { useEffect, useRef, useState } from 'react';
import { CalendarPlus, Check, ChevronDown, Download } from 'lucide-react';
import type { CampusEvent } from '../lib/types';
import { downloadIcs, googleCalendarUrl, outlookCalendarUrl } from '../lib/calendar';

interface Props {
  event: CampusEvent;
  saved: boolean;
  onSave: () => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}

/**
 * Add-to-calendar with Google as the default click and the other targets behind a split menu.
 *
 * The split exists because a three-option menu on every card would cost two clicks for the ~80% of
 * students on Google. Clicking the main body of the button goes straight to Google; the chevron
 * opens Outlook and .ics for everyone else.
 */
export function AddToCalendar({ event, saved, onSave, size = 'md', fullWidth }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openTarget = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    if (!saved) onSave();
    setOpen(false);
  };

  const pad = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm';
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div ref={wrap} className={`relative inline-flex shrink-0 ${fullWidth ? 'w-full' : ''}`}>
      <div
        className={`inline-flex overflow-hidden rounded-lg border font-medium transition-colors duration-150 ${
          fullWidth ? 'w-full' : ''
        } ${
          saved
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-navy bg-navy text-white hover:bg-navy-600'
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openTarget(googleCalendarUrl(event));
          }}
          aria-label={`Add ${event.title} to Google Calendar`}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap ${pad}`}
        >
          {saved ? <Check className={icon} aria-hidden /> : <CalendarPlus className={icon} aria-hidden />}
          {saved ? 'Added' : size === 'sm' ? 'Add' : 'Add to calendar'}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-label="Other calendar options"
          aria-expanded={open}
          className={`border-l px-1.5 ${
            saved ? 'border-emerald-200 hover:bg-emerald-100' : 'border-white/25 hover:bg-navy-700'
          }`}
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lift"
        >
          <MenuItem onClick={() => openTarget(googleCalendarUrl(event))}>Google Calendar</MenuItem>
          <MenuItem onClick={() => openTarget(outlookCalendarUrl(event))}>Outlook / Office 365</MenuItem>
          <MenuItem
            onClick={() => {
              downloadIcs([event], `${event.id.replace(/[^\w-]/g, '-')}.ics`, event.title);
              if (!saved) onSave();
              setOpen(false);
            }}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Download .ics (Apple, other)
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-canvas"
    >
      {children}
    </button>
  );
}
