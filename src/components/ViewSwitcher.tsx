import { Check, ChevronDown, Info, Rss, SlidersHorizontal, X } from 'lucide-react';
import type { ViewId } from '../lib/types';
import { VIEWS, VIEW_GROUPS, viewById, viewsInGroup } from '../lib/views';

/**
 * One app, five surfaces, one place to move between them.
 *
 * The alternative — shipping two or three separate deployments — was rejected: it would duplicate
 * the data layer, the filter engine and the calendar export three times, and give whoever is being
 * pitched three URLs to keep straight. Everything here is the same engine; only the skin changes,
 * and that is exactly what the switcher should make obvious.
 *
 * The bar is deliberately styled *unlike* BYU — near-black, small, dense — so it never reads as
 * part of the BYU surfaces it sits above. It is scaffolding around the prototype, not the product.
 *
 * Desktop gets the full switcher inline. Below `sm` there is no room for five chips plus controls,
 * so it collapses to the current view's name and opens the Views sheet, which is the "links page"
 * version: every surface, grouped, with a sentence on what each is for.
 */

interface Props {
  view: ViewId;
  onViewChange: (view: ViewId) => void;
  onOpenFilters: () => void;
  onOpenSubscribe: () => void;
  onOpenAbout: () => void;
  onOpenViews: () => void;
  activeFilterCount: number;
}

export function ViewSwitcher({
  view,
  onViewChange,
  onOpenFilters,
  onOpenSubscribe,
  onOpenAbout,
  onOpenViews,
  activeFilterCount
}: Props) {
  const current = viewById(view);

  return (
    <div className="sticky top-0 z-40 bg-byu-black text-white">
      <div className="mx-auto flex max-w-[1200px] items-center gap-2 px-3 py-1.5 sm:px-6">
        <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-white/40 lg:inline">
          Prototype
        </span>

        {/* Mobile: the current view, tappable, opening the Views sheet. */}
        <button
          type="button"
          onClick={onOpenViews}
          className="flex min-w-0 items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-white hover:bg-white/10 sm:hidden"
        >
          <current.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{current.label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 text-white/50" aria-hidden />
        </button>

        {/* Desktop: all five, grouped, with a divider between the families. */}
        <nav aria-label="Choose a view" className="hidden items-center gap-0.5 sm:flex">
          {VIEW_GROUPS.map((group, groupIndex) => (
            <span key={group.id} className="flex items-center gap-0.5">
              {groupIndex > 0 && <span className="mx-1.5 h-4 w-px bg-white/20" aria-hidden />}
              {viewsInGroup(group.id).map((definition) => {
                const Icon = definition.icon;
                const on = view === definition.id;
                return (
                  <button
                    key={definition.id}
                    type="button"
                    onClick={() => onViewChange(definition.id)}
                    aria-current={on}
                    title={definition.blurb}
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                      on ? 'bg-white text-byu-black' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                    {definition.label}
                  </button>
                );
              })}
            </span>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onOpenFilters}
            className="relative inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
          >
            <SlidersHorizontal className="h-3 w-3" aria-hidden />
            <span className="hidden sm:inline">My interests</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-byu-red px-1 text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onOpenSubscribe}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
          >
            <Rss className="h-3 w-3" aria-hidden />
            <span className="hidden sm:inline">Subscribe</span>
          </button>
          <button
            type="button"
            onClick={onOpenAbout}
            aria-label="About this prototype and its data sources"
            className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The Views sheet. This is the "links page" — the one screen that explains the whole prototype,
 * naming each surface and what it is for, rather than making someone guess from an icon.
 */
export function ViewsSheet({
  open,
  current,
  onSelect,
  onClose
}: {
  open: boolean;
  current: ViewId;
  onSelect: (view: ViewId) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a view"
        className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-lift sm:max-w-lg sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl text-ink">Views</h2>
            <p className="mt-0.5 text-xs leading-snug text-muted">
              Same events, same filters, same calendar sync in every one. Only the design changes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-muted hover:bg-canvas hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          {VIEW_GROUPS.map((group) => (
            <section key={group.id}>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-navy-400">
                {group.label}
              </h3>
              <p className="mb-2 text-xs text-muted">{group.caption}</p>
              <ul className="flex flex-col gap-1.5">
                {viewsInGroup(group.id).map((definition) => {
                  const Icon = definition.icon;
                  const on = current === definition.id;
                  return (
                    <li key={definition.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(definition.id);
                          onClose();
                        }}
                        aria-current={on}
                        className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                          on
                            ? 'border-navy bg-navy-50'
                            : 'border-line bg-white hover:border-navy-200 hover:bg-canvas'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            on ? 'bg-navy text-white' : 'bg-canvas text-navy'
                          }`}
                        >
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-ink">{definition.title}</span>
                            {on && <Check className="h-3.5 w-3.5 text-navy" aria-hidden />}
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-muted">
                            {definition.blurb}
                          </span>
                          <span className="mt-1 block text-[11px] leading-snug text-navy-500">
                            Best for: {definition.bestFor}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-5 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
          {VIEWS.length} views, one codebase. Your interests, saved events and calendar subscription
          follow you between them.
        </p>
      </div>
    </div>
  );
}
