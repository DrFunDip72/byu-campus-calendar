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

## Two axes, nine combinations, one engine

One app, one URL. Data, search, filtering, preferences and calendar sync are identical everywhere —
only presentation changes.

Navigation asks **two separate questions**, because they are genuinely separate questions: where
this would live is a decision for BYU, and how events are laid out is a decision for students.

**Where this lives** — the same proposal wearing three skins:

| | Thesis | Best at | Worst at |
| --- | --- | --- | --- |
| **Today's BYU Website** | "What would this look like on our site?" | Showing leadership it fits the site they already run | Density — a carousel row hides most of itself |
| **Today's BYU App** | "…and on our app?" | Showing it where students actually are | Small screen means less context per event |
| **A purpose-built calendar** *(default)* | "What would you build with a free hand?" | Showing the idea at full strength | Answers no question about adoption |

**Layout** — how the events themselves are arranged, available in all three placements:

| | Thesis | Best at | Worst at |
| --- | --- | --- | --- |
| **List** | "What's on today?" | Answering a specific question fast (~12 events/screen) | Making an unknown event look appealing |
| **Cards** | "Show me something good" | Discovery and serendipity | Density; favours events with good artwork |
| **Month** | "What does my month look like?" | Density, conflicts, planning | Discovery; needs real screen width |

The whole prototype therefore reduces to one sentence, which is printed in the switcher itself:
*same events, same filters — pick where it lives and how it looks.* On mobile both axes collapse
into a sheet that names every option and what it is for, and **Compare** puts all three layouts
side by side so choosing between them is not a memory test.

This replaced a flat row of five tabs (BYU Website · BYU App · Feed · Discover · Planner) that
could not be explained out loud: it mixed the two questions together, and the BYU App tab had its
own internal Feed/Discover/Month, so "Feed" meant two different things depending on where you
stood. Old links still work — `?view=` and `?design=` resolve onto the matrix.

Both BYU recreations are matched to the real thing, not eyeballed: the website's values come from
its own Brightspot stylesheet, and the app's palette was sampled pixel-by-pixel from a screen
recording. Today's BYU app shows one day at a time, which is the gap the proposal is built around;
that original behaviour stays viewable at `?placement=app&mode=day` for a before/after. A
near-black "Prototype" strip sits above every surface so nobody mistakes a recreation for the real
page.

### The events marked DEMO

The snapshot is **476 real BYU events plus 20 clearly-badged stand-ins**. The stand-ins exist
because of a chicken-and-egg problem: BYU's public feed carries zero hackathons, zero conferences,
and a single undifferentiated `clubs` bucket with no way to follow a named association — so the
headline feature had almost nothing real to filter. Adding nothing would make the feature look
pointless; adding them silently would overstate the data. They are labelled on every card, counted
separately in the About panel, and excluded from the 476. See `scripts/seed-demo.mjs`.

Full reasoning, rejected alternatives and every trade-off: **[`docs/DECISIONS.md`](docs/DECISIONS.md)**.

---

## Running it

```bash
npm install
npm run dev      # http://localhost:5173 — also serves /feed.ics
```

```bash
npm run build:data  # re-pull BYU's calendar, then re-merge the badged stand-ins
npm run refresh  # just the BYU pull (drops the stand-ins; follow with `npm run seed`)
npm run seed     # just the stand-ins
npm run smoke    # server-render all nine combinations and assert behaviour (117 checks)
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
src/lib/filters.ts         search and filtering, shared by every combination
src/lib/calendar.ts        Google / Outlook / .ics export and subscription URLs
src/lib/prefs.ts           localStorage + URL-synced preferences
scripts/audit-taxonomy.mjs structural-vs-free-text precision per interest rule
src/lib/views.ts           the registry — placements and layouts, names, descriptions
src/views/                 CampusView · ByuAppView · FeedView · DiscoverView · PlannerView
src/views/LayoutRenderer   maps a layout id to its component, used by the app and by Compare
src/components/ByuChrome   recreation of calendar.byu.edu's header, feature bar and footer
src/components/SurfaceSwitcher  the two-row top bar and the mobile sheet
src/components/CompareDialog    all three layouts side by side
src/components/WelcomeCard      the arrival card, shown once per browser
src/components/FeedbackBar      the floating feedback button and the survey it opens
src/components/DemoBadge        the DEMO marker on stand-in events
scripts/seed-demo.mjs      merges the badged stand-ins into the snapshot
src/lib/pwa.ts             service-worker registration (no install prompt — see below)
public/sw.js               offline shell; never caches /feed.ics
scripts/make-icons.sh      generates the PWA icon set with ffmpeg
api/feed.ts                /feed.ics — live filtered iCalendar subscription
api/feedback.ts            POST a survey response; one Blob per response
api/feedback-results.ts    the private tally page, guarded by FEEDBACK_ADMIN_KEY
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

## Usage tracking and feedback

### Analytics

[Vercel Web Analytics](https://vercel.com/docs/analytics) — no cookies, no consent banner, free on
the current plan. Page views and visitors are automatic; custom events answer what raw page views
cannot, since every combination lives at the same URL:

| Event | Question |
| --- | --- |
| `placement_change` | Where would people put this? *(the pitch question)* |
| `layout_change` | Which layout do students prefer? *(the design question)* |
| `add_to_calendar` | Did anyone act on an event? |
| `subscribe` | Did anyone want the feed permanently? |
| `follow_interest` | Which interests do students actually want? |
| `feedback` | How many answered the survey, and how? |
| `compare_open` | Did anyone compare the layouts? |

`placement_change` and `layout_change` replaced a single `view_change` when navigation split into
two axes — collapsing both into one event would make the two most interesting numbers impossible
to separate.

**One-time setup:** Vercel dashboard → the project → **Analytics** → **Enable**. Nothing is
collected until that toggle is on.

### The arrival card and the feedback button

Two pieces, in order:

1. **An arrival card**, once per browser. It says this is a student project and not an official BYU
   site, names the real-vs-stand-in event counts, explains the two axes in one sentence each, and
   then hands off to the feedback button — which is deliberately raised above the card's own scrim,
   so the one lit control on a dimmed screen is the one the card is describing. `?welcome=0`
   suppresses it, and records that, for a live demo or a screenshot run.
2. **A floating button**, bottom-right, on every placement and every layout. Pressing it opens
   *"Would you actually use this?"*, then one follow-up screen: preferred layout, whether you are a
   student, and an optional comment.

Nothing appears on a timer and nothing is suppressed by a stored dismissal. The first version got
both backwards — a 25-second pop-up plus a text link in the footer — so the feedback route was
invisible to anyone who looked around briefly and left, and an interruption to anyone who stayed.

The button and the survey are one component with one state machine. They share a corner and must
never both be on screen, and the arrangement they replace (a timer in the bar, an open-signal
counter in `App`) is the same two-controls-one-state shape that once desynchronised the layout
switchers.

Responses go to **Vercel Blob, one small blob per response**. That is deliberate: append-only by
construction so concurrent submissions cannot overwrite each other, no connection pooling, and
nothing that auto-pauses. A free Postgres project that idles a week can need a manual restore,
which would silently drop responses weeks into a feedback window — exactly when nobody is looking.

Nothing identifying is collected: no name, email, sign-in, IP or user agent. The store is private,
so no response is reachable by URL.

Every submission is recorded **twice on purpose** — a Blob write for the written comments and an
analytics event for the count — because the count must survive a storage failure and the comments
cannot be reconstructed from a count.

Read the tally at **`/api/feedback-results?key=…`** (`FEEDBACK_ADMIN_KEY`): a self-contained page
with the verdict split, preferred-layout bars, and every comment. No build step, no dashboard,
readable on a phone.

### No install prompt

The manifest and offline service worker are kept — they cost nothing and campus wifi is
unreliable — but **nothing prompts a student to install this**. BYU already ships a mobile app,
and one of the three placements is a proposal for that app's calendar tab; asking for a
home-screen slot alongside it argues against the pitch.

## What it does not cover yet

Stated in the app under the info icon, and in detail in `docs/DECISIONS.md`:

- **Club and association events** — the public API has no *vocabulary* for them: zero hackathons
  across all 476 real records, and `clubs` is one flat bucket of ~15 with no way to follow a named
  association. **BYU's own mobile app does carry them, with a dedicated Club field** (Marketing
  Association, Pre-Nursing, Cybersecurity Students Academic Association, Investment Banking
  Association). The data already exists inside BYU. The ask is not "get clubs to publish" — it is
  read access to the feed BYU's own app already uses. Biggest gap, cheapest to close.
- **Most college/department calendars** — only a dozen organizations publish a usable host name.
- **Intramurals and Y-Serve** — separate systems.
- **A student's class schedule** — needs BYU sign-in; would enable conflict detection.

The pipeline is built and working. What it needs is source access, not more engineering — and BYU
already runs a public "Submit an Event" form, so the pipe exists. Full investigation of every
source probed: [`docs/DATA-INVESTIGATION.md`](docs/DATA-INVESTIGATION.md).
