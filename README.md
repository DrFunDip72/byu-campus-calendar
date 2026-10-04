# BYU Campus Calendar

**Every event on campus, in one place, filtered to what a student actually cares about.**

Athletics, arts, student life, lectures, devotionals and career fairs from BYU's own calendar
systems — searchable, filterable by interest, and syncable to Google / Apple / Outlook as a live
subscription. Four interchangeable layouts are shipped side by side — including a recreation of
calendar.byu.edu's own design — so BYU leadership can compare them against real data.

> A student-built proposal, not an official BYU product. All event data belongs to BYU and links
> back to the official pages.

---

## The problem

A student who wants to know when the football game, the Homecoming dance, their association's
meeting and the next hackathon are has to check four different sites and will miss at least one.
The content already exists and BYU already owns it — it just isn't aggregated or filterable.

## What this does

- **Pulls every category** from the public BYU calendar API via `categories=all`, plus the CS
  department's ICS feeds. (Listing the nine main category ids instead silently misses ~55% of
  events — see [`docs/DATA-INVESTIGATION.md`](docs/DATA-INVESTIGATION.md).)
- **Derives ~50 student-facing interests** from event text, because the API's own grouping fields
  are too coarse to filter on. Nobody follows "Athletics"; they follow *football*. Rule precision is
  measurable with `npm run audit`.
- **Lets a student follow interests once** and keeps that feed, with no login.
- **Turns those filters into a live calendar subscription**, so new matching events arrive in the
  calendar app they already check.
- **States its own coverage gaps in the UI**, rather than letting a reviewer discover them.

## Four designs, one engine

Switch in the header. Data, search, filtering, preferences and export are identical in all four —
only presentation changes.

| | Thesis | Best at | Worst at |
| --- | --- | --- | --- |
| **BYU.edu** *(default)* | "What would this look like on our site?" | Showing leadership the idea inside their own design system | Density — a carousel row hides most of itself |
| **Feed** | "What's on today?" | Answering a specific question fast (~12 events/screen) | Making an unknown event look appealing |
| **Discover** | "Show me something good" | Discovery and serendipity | Density; favours events with good artwork |
| **Planner** | "What does my month look like?" | Density, conflicts, planning | Discovery; needs real screen width |

**BYU.edu** is a recreation of `calendar.byu.edu/home` — navy section bars, promo-card carousel
rows, the real footer — with every value matched to that site's own stylesheet rather than eyeballed
from a screenshot. It exists so a pitch conversation can be about the idea instead of about whether
it would fit the site. A near-black "Prototype" strip sits above it so nobody mistakes it for the
real page.

Full reasoning, rejected alternatives and every trade-off: **[`docs/DECISIONS.md`](docs/DECISIONS.md)**.

---

## Running it

```bash
npm install
npm run dev      # http://localhost:5173 — also serves /feed.ics
```

```bash
npm run refresh  # re-pull the BYU calendar into src/data/events.json
npm run smoke    # server-render all four designs and assert behaviour
npm run audit    # report how precise each interest rule is
npm run build    # typecheck + production build
```

## How the data flows

```
calendar.byu.edu/api/Events.json  ─┐
  (categories=all, 1 week/request,            scripts/fetch-events.mjs
   53 requests for 365 days)       ├────────▶  · normalize + attach Denver offset
                                   │           · classify into interests (taxonomy.mjs)
cs.byu.edu  ───────────────────────┘           · de-duplicate across sources
  (per-event ICS files)                        · emit the interest catalog
                                                       │
                                                       ▼
                                          src/data/events.json  (committed)
                                                       │
                              ┌────────────────────────┴───────────────────────┐
                              ▼                                                ▼
                    React app (4 layouts)                        api/feed.ts → /feed.ics
                    shared filter engine                         live filtered subscription
```

The snapshot is **committed and shipped**, not fetched at runtime: `calendar.byu.edu` is behind
CloudFront, which 403s some datacenter IPs, so a serverless fetch isn't dependably available. A
GitHub Action re-pulls daily, runs the smoke test and build, and commits only if something changed.

## Layout

```
scripts/taxonomy.mjs       the interest ruleset — the one place classification lives
scripts/fetch-events.mjs   ingest: fetch, normalize, classify, de-duplicate, emit
scripts/smoke.mjs          server-renders the real app and asserts behaviour
src/data/events.json       committed snapshot (events + interest catalog + source metadata)
src/lib/filters.ts         search and filtering, shared by all four designs
src/lib/calendar.ts        Google / Outlook / .ics export and subscription URLs
src/lib/prefs.ts           localStorage + URL-synced preferences
scripts/audit-taxonomy.mjs structural-vs-free-text precision per interest rule
src/views/                 CampusView · FeedView · DiscoverView · PlannerView
src/components/ByuChrome   recreation of calendar.byu.edu's header and footer
api/feed.ts                /feed.ics — live filtered iCalendar subscription
docs/DECISIONS.md          design decisions and trade-offs
```

## Adding a source

One function. Return records in the shape `normalizeByu` produces, push them into the array in
`main()`, and de-duplication and classification handle the rest. `fetchCsDepartment()` is the
worked example — it exists mainly to prove the multi-source path, and it correctly merges its
"Grad School Fair" with the main calendar's "Graduate School Fair".

## The subscription endpoint

```
/feed.ics                                  every event
/feed.ics?interests=football,dance         just those interests
/feed.ics?orgs=BYU%20Athletics&free=1      by host, free only
/feed.ics?q=notre%20dame                   free-text
```

Returns `text/calendar`. An unknown interest id returns **400 rather than an empty calendar**,
because "nothing is scheduled" is a more confusing failure than an error.

## What it does not cover yet

Stated in the app under the info icon, and in detail in `docs/DECISIONS.md`:

- **Club and association events** — not published to the BYU calendar system at all. Verified: 0
  matches for hackathon or PMA across 626 records / 365 days. The biggest gap.
- **Most college/department calendars** — only 11 organizations publish a usable host name.
- **Intramurals and Y-Serve** — separate systems.
- **A student's class schedule** — needs BYU sign-in; would enable conflict detection.

The pipeline is built and working. What it needs is source access, not more engineering — and BYU
already runs a public "Submit an Event" form, so the pipe exists. Full investigation of every
source probed: [`docs/DATA-INVESTIGATION.md`](docs/DATA-INVESTIGATION.md).
