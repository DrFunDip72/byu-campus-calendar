import { Check, ChevronDown, Columns3, Info, Rss, SlidersHorizontal, X } from 'lucide-react';
import type { LayoutId, PlacementId } from '../lib/types';
import { LAYOUTS, PLACEMENTS, layoutById, placementById } from '../lib/views';

/**
 * Navigation, as two labelled questions rather than one row of unexplained tabs.
 *
 * The flat five-tab version this replaces could not be narrated. It mixed "where would this live?"
 * with "how are events laid out?", and the BYU App tab had its own internal Feed/Discover/Month,
 * so "Feed" meant two different things depending on where you stood. Nobody could be handed the
 * link and told what they were looking at.
 *
 * Splitting the axes and naming them out loud makes the whole prototype reduce to one sentence,
 * which is printed in the bar itself: same events, same filters — pick where it lives and how it
 * looks. The row labels ("Where this lives" / "Layout") are not decoration; they are the thing
 * that makes the control self-explanatory to someone who arrived from a link.
 *
 * The bar is deliberately styled *unlike* BYU — near-black, small, dense — so it never reads as
 * part of the BYU surfaces it sits above. It is scaffolding around the prototype, not the product.
 *
 * Below `sm` there is no room for six chips plus controls, so it collapses to the current
 * combination and opens the sheet, which is the "links page" version: both axes, every option,
 * with a sentence on what each is for.
 */

interface Props {
  placement: PlacementId;
  layout: LayoutId;
  onPlacementChange: (placement: PlacementId) => void;
  onLayoutChange: (layout: LayoutId) => void;
  onOpenFilters: () => void;
  onOpenSubscribe: () => void;
  onOpenAbout: () => void;
  onOpenViews: () => void;
  onOpenCompare: () => void;
  activeFilterCount: number;
  eventCount: number;
}

export function SurfaceSwitcher({
  placement,
  layout,
  onPlacementChange,
  onLayoutChange,
  onOpenFilters,
  onOpenSubscribe,
  onOpenAbout,
  onOpenViews,
  onOpenCompare,
  activeFilterCount,
  eventCount
}: Props) {
  const currentPlacement = placementById(placement);
  const currentLayout = layoutById(layout);

  return (
    <div className="sticky top-0 z-40 bg-byu-black text-white">
      <div className="mx-auto max-w-[1200px] px-3 sm:px-6">
        {/* ---- Row 1: where this lives, plus the global controls ---- */}
        <div className="flex items-center gap-2 py-1.5">
          <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-white/40 lg:inline">
            Prototype
          </span>

          {/* Mobile: the current combination, tappable, opening the sheet. */}
          <button
            type="button"
            onClick={onOpenViews}
            className="flex min-w-0 items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-white hover:bg-white/10 sm:hidden"
          >
            <currentPlacement.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {currentPlacement.label} · {currentLayout.label}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 text-white/50" aria-hidden />
          </button>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
              Where this lives
            </span>
            <nav aria-label="Where this calendar would live" className="flex items-center gap-0.5">
              {PLACEMENTS.map((definition) => {
                const Icon = definition.icon;
                const on = placement === definition.id;
                return (
                  <button
                    key={definition.id}
                    type="button"
                    onClick={() => onPlacementChange(definition.id)}
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
            </nav>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onOpenCompare}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              <Columns3 className="h-3 w-3" aria-hidden />
              <span className="hidden sm:inline">Compare</span>
            </button>
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

        {/* ---- Row 2: layout, plus the sentence that explains the whole thing ---- */}
        <div className="hidden items-center gap-2 border-t border-white/10 py-1.5 sm:flex">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
            Layout
          </span>
          <nav aria-label="How events are laid out" className="flex items-center gap-0.5">
            {LAYOUTS.map((definition) => {
              const Icon = definition.icon;
              const on = layout === definition.id;
              return (
                <button
                  key={definition.id}
                  type="button"
                  onClick={() => onLayoutChange(definition.id)}
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
          </nav>

          {/* The sentence. If a reviewer reads nothing else in this bar, this is the one that makes
              the nine combinations legible instead of looking like nine unrelated pages. */}
          <p className="ml-auto hidden truncate pl-3 text-[11px] text-white/45 lg:block">
            Same {eventCount} events and filters in all nine — pick where it lives and how it looks.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The surface sheet. This is the "links page" — the one screen that explains the whole prototype,
 * naming both axes and what each option is for, rather than making someone guess from an icon.
 */
export function ViewsSheet({
  open,
  placement,
  layout,
  onPlacementChange,
  onLayoutChange,
  onOpenCompare,
  onClose
}: {
  open: boolean;
  placement: PlacementId;
  layout: LayoutId;
  onPlacementChange: (placement: PlacementId) => void;
  onLayoutChange: (layout: LayoutId) => void;
  onOpenCompare: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a surface"
        className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-lift sm:max-w-lg sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl text-ink">Choose a view</h2>
            <p className="mt-0.5 text-xs leading-snug text-muted">
              Two choices, not nine pages. Same events, same filters, same calendar sync in every
              combination — only where it lives and how it looks change.
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
          <Axis
            heading="Where this lives"
            caption="The same proposal, wearing three different skins."
            options={PLACEMENTS}
            current={placement}
            onSelect={(id) => onPlacementChange(id as PlacementId)}
          />
          <Axis
            heading="Layout"
            caption="How the events themselves are arranged. Works in all three placements."
            options={LAYOUTS}
            current={layout}
            onSelect={(id) => onLayoutChange(id as LayoutId)}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            onOpenCompare();
            onClose();
          }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-navy bg-navy-50 px-4 py-2.5 text-sm font-semibold text-navy hover:bg-navy-100"
        >
          <Columns3 className="h-4 w-4" aria-hidden />
          See all three layouts side by side
        </button>
      </div>
    </div>
  );
}

/** One axis of the sheet. Both axes render identically, which is itself the point being made. */
function Axis({
  heading,
  caption,
  options,
  current,
  onSelect
}: {
  heading: string;
  caption: string;
  options: {
    id: string;
    label: string;
    title?: string;
    blurb: string;
    bestFor: string;
    icon: typeof Info;
  }[];
  current: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-navy-400">{heading}</h3>
      <p className="mb-2 text-xs text-muted">{caption}</p>
      <ul className="flex flex-col gap-1.5">
        {options.map((definition) => {
          const Icon = definition.icon;
          const on = current === definition.id;
          return (
            <li key={definition.id}>
              <button
                type="button"
                onClick={() => onSelect(definition.id)}
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
                    <span className="text-sm font-semibold text-ink">
                      {definition.title ?? definition.label}
                    </span>
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
  );
}
