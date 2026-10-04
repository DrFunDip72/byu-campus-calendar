# BYU Campus Calendar

**Every event on campus, in one place, filtered to what a student actually cares about.**

Athletics, arts, student life, lectures, devotionals and career fairs from BYU's own calendar
systems — searchable, filterable by interest, and syncable to Google / Apple / Outlook as a live
subscription. Installs as a PWA. Five interchangeable surfaces ship side by side — including
recreations of **calendar.byu.edu** and of the **BYU mobile app's Calendar tab** — so BYU leadership
can compare them against real data.

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

## Five surfaces, one engine

One app, one URL. Data, search, filtering, preferences and calendar sync are identical everywhere —
only presentation changes. Switch in the top bar; on mobile that bar opens the **Views sheet**,
which names every surface and what it is for.

**Inside BYU's products** — the same features wearing BYU's existing design:

| | Thesis | Best at | Worst at |
| --- | --- | --- | --- |
| **BYU Website** *(default)* | "What would this look like on our site?" | Showing leadership it fits the site they already run | Density — a carousel row hides most of itself |
| **BYU App** | "…and on our app?" | Showing it where students actually are | Small screen means less context per event |

**Our concepts** — what a purpose-built campus calendar could be:

| | Thesis | Best at | Worst at |
| --- | --- | --- | --- |
| **Feed** | "What's on today?" | Answering a specific question fast (~12 events/screen) | Making an unknown event look appealing |
| **Discover** | "Show me something good" | Discovery and serendipity | Density; favours events with good artwork |
| **Planner** | "What does my month look like?" | Density, conflicts, planning | Discovery; needs real screen width |

Both BYU recreations are matched to the real thing, not eyeballed: the website's values come from
its own Brightspot stylesheet, and the app's palette was sampled pixel-by-pixel from a screen
recording. The **BYU App** surface adds four layouts inside the Calendar tab (Day · Feed · Discover
· Month), interest filters on the funnel, and one-tap add-to-calendar — all things the real app's
calendar cannot do. A near-black "Prototype" strip sits above every surface so nobody mistakes a
recreation for the real page.

Full reasoning, rejected alternatives and every trade-off: **[`docs/DECISIONS.md`](docs/DECISIONS.md)**.

---

## Running it

```bash
npm install
npm run dev      # http://localhost:5173 — also serves /feed.ics
```

```bash
npm run refresh  # re-pull the BYU calendar into src/data/events.json
npm run smoke    # server-render all five surfaces and assert behaviour (42 checks)
npm run audit    # report how precise each interest rule is
npm run build    # typecheck + production build
bash scripts/make-icons.sh   # regenerate the PWA icon set
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
                    React app (5 surfaces)                       api/feed.ts → /feed.ics
                    shared filter engine, PWA                    live filtered subscription
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
src/lib/filters.ts         search and filtering, shared by all five surfaces
src/lib/calendar.ts        Google / Outlook / .ics export and subscription URLs
src/lib/prefs.ts           localStorage + URL-synced preferences
scripts/audit-taxonomy.mjs structural-vs-free-text precision per interest rule
src/lib/views.ts           the surface registry — ids, names, groups, descriptions
src/views/                 CampusView · ByuAppView · FeedView · DiscoverView · PlannerView
src/components/ByuChrome   recreation of calendar.byu.edu's header, feature bar and footer
src/components/ViewSwitcher  the top bar and the mobile Views sheet
src/lib/pwa.ts             install prompt (Chrome + iOS) and service-worker registration
public/sw.js               offline shell; never caches /feed.ics
scripts/make-icons.sh      generates the PWA icon set with ffmpeg
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

- **Club and association events** — not on the *public* API (0 matches for hackathon or PMA across
  626 records / 365 days), **but present in BYU's own mobile app**. The data exists inside BYU; the
  ask is read access to that feed. The biggest gap and the cheapest to close.
- **Most college/department calendars** — only 11 organizations publish a usable host name.
- **Intramurals and Y-Serve** — separate systems.
- **A student's class schedule** — needs BYU sign-in; would enable conflict detection.

The pipeline is built and working. What it needs is source access, not more engineering — and BYU
already runs a public "Submit an Event" form, so the pipe exists. Full investigation of every
source probed: [`docs/DATA-INVESTIGATION.md`](docs/DATA-INVESTIGATION.md).
