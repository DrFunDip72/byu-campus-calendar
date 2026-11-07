# Design decisions and trade-offs

Written as the project was built, for the BYU leadership conversation. Every section is a real fork
in the road with the option we took, the options we rejected, and what we gave up.

---

## 1. The problem we are solving

Events at BYU are real, public, and findable — just not in one place. A student who wants to know
when the football game, the Homecoming dance, their association's meeting, and the next hackathon
are has to check the main calendar, an athletics site, a club page, and a department page. Four
places, four interfaces, and they will miss at least one.

This is not a content problem. It is an **aggregation and filtering** problem. The content already
exists and BYU already owns it.

**Our success measure:** a student can answer "what is happening that I care about" in under ten
seconds, and then never has to come back, because the answer arrives in the calendar app they
already check.

---

## 2. Data sources

### What we pull

| Source | Mechanism | Status | Volume |
| --- | --- | --- | --- |
| `calendar.byu.edu` | Public JSON API (`/api/Events.json?categories=all`) | **Live** | 642 records → 621 unique |
| `cs.byu.edu` | Per-event ICS files linked from the dept calendar | **Live** | 2 records |

The main calendar API is the backbone, and we request `categories=all`.

> **Trade-off we reversed from the prior project.** The hackathon project this grew out of pulled
> only three categories (`49+4+1006`) because it only wanted career events, and it actively
> *discarded* dances, devotionals and FHE as noise. For a comprehensive campus calendar those are
> the product. Athletics (category 10) in particular is where every football and basketball game
> lives, and it was not being pulled at all.

> **A second undercount we then found in our own code.** Our first version listed the nine main
> category ids explicitly. BYU's docs claim that is equivalent to `categories=all`; it is not.
> Events whose *primary* category is a department ("School of Music", "BRAVO! Events", "Academic
> Calendar") are unreachable that way, and the request still returns a plausible 200. Switching to
> `categories=all` took the pull from 404 to 642 raw records — a ~55% silent undercount.
> Full write-up: [`DATA-INVESTIGATION.md`](DATA-INVESTIGATION.md).

### Why the API has to be windowed

The API caps each response at roughly 100 events. A naive 9-month request silently returns a
truncated list — the worst kind of bug, because it looks like it worked. We request **one week at a
time** (53 requests for 365 days) and log a warning if any single window comes back at 100+, so
truncation can never happen silently.

### What we do *not* cover, and why it matters

This is the honest part, and it is surfaced in the product itself under the info icon.

| Gap | Why | Impact |
| --- | --- | --- |
| **Club and association events** | Not on the *public* calendar API: 0 matches for hackathon or PMA across 626 records / 365 days. **But BYU's own mobile app shows them** — Marketing Association, Pre-Nursing, Investment Banking Association — with a dedicated "Club" field. The endpoint behind it is undocumented and authenticated. | **The biggest gap, and the cheapest to close.** It is why "Hackathons" and "Study Abroad" show zero. The data already exists inside BYU; the ask is read access to the same feed their app uses, not a new publishing programme. See [`DATA-INVESTIGATION.md`](DATA-INVESTIGATION.md). |
| **Most college/department calendars** | Only 11 organizations publish a usable host name to the API. | CS is wired up to prove per-department sources merge cleanly. Each other college needs the same ~40 lines. |
| **Intramurals, Y-Serve** | Separate systems. | Significant student-life volume missing. |
| **A student's class schedule** | Needs BYU sign-in. | Highest-value *addition*: it would let the calendar hide events that collide with classes. |

**The ask this implies:** the pipeline is built and working. What it needs from BYU is read access
to one feed it already operates — the club-events source behind the BYU app's Calendar tab — not
more engineering and not a new content programme.

---

## 3. A build-time snapshot, not a runtime fetch

**Decision:** the ingest runs as a script, writes `src/data/events.json`, and that file is committed
and shipped with the app. A GitHub Action re-runs it daily and commits the result.

**Why, in order of importance:**

1. **Reliability.** `calendar.byu.edu` sits behind CloudFront, which returns 403 to some datacenter
   IP ranges. A serverless function fetching it at request time is therefore not dependably
   available. A committed snapshot always is. This was a documented problem in the prior project.
2. **Latency.** A full pull is ~40 sequential HTTP requests. That is an acceptable build step and an
   unacceptable page load.
3. **It fits the data.** The feed is public, identical for every student, and changes a few times a
   day at most. There is nothing per-user to compute.

**What we gave up:** events added to the BYU calendar show up here within a day, not instantly. For
a campus calendar where the nearest event is hours away, that is the right trade. If BYU wanted
real-time, the fix is a server-side cache with a short TTL, not a different architecture.

**Rejected:** a database (Postgres/Railway, as the prior project used). It adds a service to run, a
cost, and a failure mode, and buys nothing until there is per-user state or writeable data.

---

## 4. The interest taxonomy — the core product decision

The API gives us two grouping fields, and **neither is a filter a student would want**:

- `CategoryName` — 9 main values (plus department categories). Too coarse. Nobody follows
  "Athletics"; they follow *football*.
- `DeptNames` — 15 distinct values across the window, of which only 11 are real organizations, and
  **234 of 623 events are just "Ticketed Events"**, a publishing bucket rather than a host.

So we derive a third layer: **~50 student-facing "interests"** across five groups, matched from the
title, category, tags and description by an ordered keyword ruleset in `scripts/taxonomy.mjs`.

```
Athletics        Football · Men's/Women's Basketball · Volleyball · Soccer · Softball · Rugby · …
Arts             Dance · Theatre · Film · Music · Visual Arts
Career           Career Fairs · Hackathons · Info Sessions · Lectures · Research · Workshops
Student Life     FHE · Clubs · Socials · Crafts · Service · Outdoors · Devotionals · Wellness · …
Academic Dates   Finals & Exams · Holidays & Breaks · Term Start & End · Graduation · Orientation
```

The **Academic Dates** group was added after the `categories=all` fix surfaced BYU's Academic
Calendar department: 69 events — finals, holidays, term boundaries, commencement — had all been
landing in the catch-all. "When do finals start" is core campus-calendar usage, so they got real
filters. The catch-all dropped from 69 events to 8.

**Design choices inside the taxonomy:**

- **Men's and women's sports are separate interests.** Someone following women's volleyball should
  not get men's basketball. The API's reliable `"<Sport> vs. <Opponent>"` title format makes this
  safe to do by keyword.
- **Events can carry several interests.** "Homecoming Dance: A Night at the Bayou" is both `dance`
  and `homecoming`, and should appear in both feeds.
- **Nothing is ever guessed.** An event matching no rule falls back to a category-derived interest,
  so every event stays reachable from some filter. No event is orphaned — asserted in the smoke test.
- **Clock times and prices are stripped before matching**, because "Programs at 7:00 and 7:30 PM"
  otherwise matches a `\bpm\b` rule and tags a craft night as product management.
- **Publishing-bucket org names are suppressed.** "Ticketed Events" as the host of a film screening
  is worse than no host at all, and being the most common value it would dominate any org list.

**Trade-off:** keyword rules are transparent, free, instant, and reviewable by a non-engineer — and
they will mis-tag edge cases that an LLM classifier would get right. We chose rules because at 385
events the error rate is inspectable by hand, and because a pitch should not depend on a per-event
API bill. The classifier is one file; swapping in an LLM later changes nothing downstream.

**The taxonomy ships with the data.** `scripts/fetch-events.mjs` writes the interest catalog (ids,
labels, counts) into `events.json`, and the frontend reads it from there. The regexes live in
exactly one file, so the filter chips can never drift out of sync with the classifier.

---

## 5. Interests with zero events are shown anyway

A student can follow "Hackathons" even though no connected source publishes one. The chip renders
with a `0`, and if they follow it, the feed says so explicitly:

> Nothing scheduled for **Hackathons** in the next 9 months from the sources we pull. Club-run
> events are not connected yet — see coverage.

**Why:** the alternative — hiding the chip — hides the coverage gap. A student would conclude BYU
has no hackathons; a reviewer would conclude the product works better than it does. Naming the gap
in the UI turns a weakness into the specific, actionable ask in §2.

---

## 6. Five surfaces, one engine

The four layouts are **presentation only**. Data, search, filtering, preferences, and calendar
export are identical and shared. A decision between them is a decision about students, not features.

| | **BYU Website** (default) | **BYU App** | **Feed** | **Discover** | **Planner** |
| --- | --- | --- | --- | --- | --- |
| **Thesis** | "What would this look like on our site?" | "...and on our app?" | "What's on today?" | "Show me something good" | "What does my month look like?" |
| **Form** | Recreation of calendar.byu.edu: navy section bars, carousel rows | Recreation of the app's Calendar tab, dark, with four layouts inside | Dense day-grouped list | Image-led cards and rails | Month grid + day panel |
| **Events per screen** | ~3 per row | ~5 | ~12 | ~4 | ~30 (titles only) |
| **Best at** | Showing leadership it fits the site they run | Showing it where students actually are | Answering a specific question fast | Discovery; serendipity | Density, conflicts, planning |
| **Worst at** | Density — a carousel hides most of the row | Small screen means less context per event | Making an unknown event look appealing | Density; favours good artwork | Discovery; needs screen width |

**Why BYU Website is the default:** this build's first job is a pitch. Opening on BYU's own layout
makes the first question "should we do this" rather than "would this fit our site". The others then
show what becomes possible once the data is unified.

**Why Feed is the best default for students:** most real visits are a specific question with time
pressure behind it. Discovery is the second visit, not the first.

### The BYU Website surface is matched, not approximated

Every value came from the live site, not from a screenshot:

- Section heading: navy `#002e5d` bar, white, 16px/1.6, bold, letter-spacing 1px, padding-left 5px
  (`.ListCardImageOnTopRow > .ListCardImageOnTop-title`).
- Card date/time: 11px, weight 300, letter-spacing .5px, uppercase, charcoal
  (`.PromoCardImageOnTop-eventDate`).
- Card title 20px, description 14px; drop shadow on the **image**, not the card:
  `0 10px 20px rgba(0,0,0,.05)`.
- Carousel buttons: 30px, square, 1px outline, fill on hover, 50% opacity when disabled
  (`.btn-carousel`).
- Palette by frequency in the real markup: `#002e5d`, `#0057b8`, `#0047ba`, `#afd6fe`, `#ff1e3c`,
  `#f0efed`. Type is IBM Plex Sans, which the site loads from Google Fonts.
- Footer: the real four column groups and the real legal line.

One rule was deliberately **not** copied: `.PromoCardImageOnTop { border: 2px solid #000 }` sits
inside an `@media print` block on the real site, so applying it on screen would have been wrong.

Two deliberate departures, both flagged in the UI:

1. **A near-black "Prototype" strip** sits above the BYU header, styled unlike BYU on purpose, so
   nobody mistakes the recreation for the real page. It holds the layout switcher and our controls.
2. **Add-to-calendar buttons on every card**, which the real site has no equivalent of. It is the
   clearest single thing this proposal adds to the page BYU already has.

**Why Discover is viable at all:** 349 of 385 events carry an `ImgUrl`. BYU already publishes event
artwork, and an image-led design built on a dataset without images would be a mock, not a prototype.

**Why all five are always visible**, rather than one shipping and four in a deck: the point of this
build is to let people compare them against real data in one sitting. See §7 for how.

---

## 7. One app, five surfaces — not three apps

**The question:** the BYU Website recreation and the BYU App recreation are different products for
different audiences. Should they be separate deployments?

**Decision: one app, one URL, five named surfaces.**

Three deployments would have meant three copies of the ingest, the taxonomy, the filter engine and
the calendar export — and three URLs for whoever is being pitched to keep straight. The entire point
of this project is that one dataset can wear any skin; shipping it as separate apps would argue the
opposite. A student's interests, saved events and subscription also follow them between surfaces,
which is only possible in one app.

**Naming is the navigation.** The surfaces are grouped into two families whose names say *why* each
one exists:

| Group | Surface | What it is |
| --- | --- | --- |
| **Inside BYU's products** | **BYU Website** | `calendar.byu.edu`'s layout, plus our search, filters and sync |
| | **BYU App** | The BYU app's Calendar tab, rebuilt around interests |
| **Our concepts** | **Feed** | Dense, scannable, grouped by day |
| | **Discover** | Image-led browsing |
| | **Planner** | Month grid with a day panel |

"BYU.edu / Feed / Discover / Planner" was the previous naming and it was worse: it put a recreation
and three originals on the same footing, so a reviewer could not tell which were proposals and which
were mirrors of what BYU already has.

**How you move between them:**

- **Desktop** — all five in the top bar, grouped, with a divider between the families.
- **Mobile** — the bar collapses to the current surface's name, which opens the **Views sheet**: the
  "links page", listing every surface with a sentence on what it is and what it is best for. It
  doubles as the explainer a first-time visitor needs.
- Rejected: a hamburger (hides the single most important control behind a tap and a guess) and a
  footer nav (invisible until you scroll past everything).

The switcher bar is deliberately styled *unlike* BYU — near-black, small, dense — so it never reads
as part of the BYU surfaces beneath it. It is scaffolding around the prototype, not the product.

**URL compatibility:** `?view=` is canonical, `?design=` is still read, and the retired `campus` id
maps onto `web`, so links shared before the rename keep working. Asserted in the smoke test.

---

## 8. The BYU App surface, and what we changed about it

Recreated from a screen recording of the real app. The colours are sampled rather than guessed —
frames extracted with ffmpeg, pixels read out of the raw RGB buffer:

```
page #041730   card #0A2D57   bar/tab #01192C   month header #076940
```

Kept from the real app: the hamburger / BYU / funnel header, the green month bar, the seven-day
strip with dots, day-grouped cards with a coloured category stripe and a square thumbnail, and the
three-tab bottom bar with Calendar active.

Changed, and these are the proposal:

1. **Four layouts inside the Calendar tab** — Day (theirs), Feed, Discover, Month. The real app has
   only the day list, which answers "what is on this exact date" and nothing else; "what's on this
   week" currently takes seven taps.
2. **The funnel filters by interest**, not just category — the same engine as every other surface.
3. **Add-to-calendar on the card.** In the real app that is three taps deep: open event → calendar
   icon → choose app.
4. **Event dots are coloured by category**, so the week strip previews what *kind* of day it is
   rather than only that something exists.

On a desktop screen it renders inside a phone frame, because a full-bleed "mobile app" on a
projector reads as a website and undersells the point.

---

## 9. Progressive web app

**Decision:** installable PWA with an offline shell, rather than a native app.

A native app would need store review, two codebases, and — most importantly — BYU already *has* a
native app. The proposal is a change to theirs, not a competitor to it. A PWA installs to the home
screen, opens full screen, and works on the shuttle with no signal, at zero distribution cost.

- **Install prompt** — `beforeinstallprompt` is captured and replayed from our own BYU-styled
  banner. iOS Safari has no such event, so it gets the literal two-tap instruction (Share → Add to
  Home Screen) and nothing is promised that cannot be delivered. Dismissal sticks for 30 days.
- **Service worker** — network-first for navigations (fresh when online, shell when not),
  cache-first for Vite's fingerprinted assets (a new build is a new URL, so a cached one can never
  be stale), and a capped image cache for BYU's CDN artwork.
- **`/feed.ics` is never cached.** A stale calendar subscription silently stops updating, which is
  worse than no offline support at all.
- **Icons are generated by a script**, not committed as unexplained binaries, and ship in both
  `any` and `maskable` variants — using the full-bleed icon as maskable is the classic PWA bug where
  Android's circular crop shaves the wordmark.

---

## 10. Preferences: no login

Interests persist in `localStorage` **and** in the URL.

- **localStorage** so a student configures once and the feed is theirs on every visit.
- **The URL** so any filtered view is shareable, and so the subscription endpoint can be handed the
  exact same filter set. The URL wins on load, because an explicitly shared link should override
  whatever the recipient had saved.

`query` and `range` are deliberately **not** persisted — a search box still holding last week's
query on a fresh visit reads as broken.

**Trade-off:** no login means no cross-device sync and no personalization beyond what the browser
remembers. For a pitch this is a feature: nobody evaluating it has to make an account. The real
version reads interests from a BYU sign-in, which also unlocks class-schedule conflict detection.

---

## 11. Calendar export: the feature that makes it stick

Four paths out, in deliberate priority order:

1. **Add to Google Calendar** — the default click on every event.
2. **Outlook / Office 365** — behind the split-button chevron, for the BYU Microsoft tenant.
3. **Download `.ics`** — Apple Calendar and everything else.
4. **Subscribe to a filtered feed** — `/feed.ics?interests=football,dance` → a live subscription.

**#4 is the one that matters.** One-off "add to calendar" is a convenience; a subscription is a
habit. A student picks their interests once, subscribes, and every new matching event appears in the
app they already check — no app to open, no notifications to manage. The same URL is what a
department would hand its own students.

Implementation notes that are easy to get wrong and were got right:

- The subscription deliberately **drops the date range**. A feed should track an interest set
  forever, not freeze on "next 7 days".
- `webcal://` is offered alongside `https://`, because that scheme is what makes Apple Calendar and
  Outlook offer to *subscribe* rather than download a one-time copy.
- A typo'd interest id returns **400, not an empty calendar** — "nothing is scheduled" is a far more
  confusing failure than an error.
- Lines are folded at 75 octets without splitting UTF-8 characters, per RFC 5545 §3.1.

---

## 12. Time zones

Every timestamp from the API arrives as Denver wall time with **no offset** (`"2026-10-09 20:15:00"`
plus a separate `Timezone` field). Passing that to `new Date()` interprets it in the *viewer's* zone,
so a student checking from an internship in New York would see every kickoff two hours late.

**Decision:** the correct Denver offset is attached once, at ingest, and the snapshot stores full ISO
strings (`2026-10-09T20:15:00-06:00`). The DST boundary is computed properly — MDT (−06:00) through
Nov 1 2026, MST (−07:00) after — and verified in both directions:

```
Football vs. Iowa State   2026-10-09 (MDT)  →  2026-10-10T02:15:00Z
Football vs. Cincinnati   2026-11-28 (MST)  →  2026-11-29T03:15:00Z
```

All display formatting is pinned to `America/Denver` regardless of the viewer's location, because
the Provo clock time is the time printed on the ticket.

---

## 13. De-duplication across sources

Two sources describing one campus double-report events, and **they do not agree on the title**: the
CS department calls it "Grad School Fair" and the main calendar calls it "Graduate School Fair" —
same room, same minute.

Two passes:

1. **Exact** normalized title + start minute. Cheap; catches re-ingests.
2. **Fuzzy** within each start minute: token overlap ≥ 75% against the shorter title, where tokens
   match if one is a prefix of the other and ≥ 4 characters. That is what makes `grad` match
   `graduate`.

The 4-character floor is the safety rail: `bas` would otherwise merge basketball into baseball, and
`mens` is deliberately not a prefix of `womens`, so gendered sports stay separate. Verified by
regression check — 18 men's basketball and 19 women's basketball events survive, as do 6 softball
and 8 volleyball games with near-identical titles.

Merges keep the **richer** record (image, longer description, a link) and union the tags, orgs and
interests, so a merge can never downgrade a listing. Both source ids are recorded and shown in the
event detail.

---

## 14. Visual design

Not a guess from a screenshot — the values are taken from BYU's own systems:

- **Navy `#002E5D`** — BYU's primary colour.
- **Royal `#0047BA`** — read straight out of the calendar API payload, which ships its own theme
  fields (`primaryLinkColor`, `headerDividerColor`, `buttonBgColor1` all return `#0047ba`).
- **IBM Plex Sans / Serif** — the API payload returns `bodyFont: "IBM Plex Sans"`.

**Category accent colours are ours, not BYU's**, and are flagged as such: the Planner grid needs
eight visually separable chips and navy-on-navy is unreadable. Each is darkened to hold at least
4.5:1 against white.

---

## 15. Testing

No browser automation was available, so `scripts/smoke.mjs` server-renders the real `App` against
the real snapshot through `react-dom/server` and asserts behaviour, not just absence of crashes
(42 checks):

- all five surfaces render, each with its own chrome, and each still offers the view switcher
- the retired `?design=campus` id still resolves, so links shared before the rename keep working
- the BYU App surface offers all four of its internal layouts and honours `?mode=`
- the PWA manifest is standalone, ships `any` **and** `maskable` icons, every icon file it names
  actually exists, and the service worker never caches `/feed.ics`
- a `football` filter shows football and **excludes basketball**
- search for "notre dame" finds the game
- a hopeless search shows the empty state
- a zero-coverage interest renders its explanation
- every event parses, carries ≥1 interest, has an explicit UTC offset, and references only interests
  that exist in the catalog

Run with `npm run smoke`. It is a real gate, not a formality — it caught the orphaned-interest class
of bug during development.

`npm run audit` is the second tool, and the more interesting one: it reports, per interest rule, how
many of its matches come from a **structural** field (title or category) versus only from free text
(tags or description). A rule matching almost nothing structurally is usually matching boilerplate.
It found three real false-positive classes that no type checker or render test would have caught:

- **all 20** "Research" matches were Harold B. Lee Library boilerplate on Craft Night listings
- **31** FHE and craft events were tagged Visual Arts for being held "at the Education in Zion Gallery"
- a stray tag had put the **Homecoming Dance** in the golf feed

The fix was to give rules a **scope**. Sports and academic dates match structural fields only;
place words like "gallery" and "library" are topical interests, while browsing *by venue* is what
the organization filter is for. An unknown scope now throws, because the first version silently
handed `undefined` to the matcher and dropped two interests to zero events — and a classifier that
returns nothing looks exactly like a campus with nothing scheduled.

---

## 16. What we would do next, in order

1. **Get a club-events source.** Largest coverage gap by far; everything else is polish.
2. **BYU sign-in** → class-schedule conflict detection ("you have class then"), cross-device sync.
3. **Notifications** for followed interests, opt-in, digest rather than per-event.
4. **Submit-an-event** form for clubs with no feed at all, with light moderation.
5. **Analytics on follows** — which interests students actually pick is a dataset BYU does not
   currently have, and it would inform programming decisions, not just this product.

---

## 17. Usage tracking

**Decision:** Vercel Web Analytics, plus five custom events.

**Why this and not the alternatives:**

| Option | Verdict |
| --- | --- |
| **Vercel Web Analytics** | **Chosen.** Already part of the hosting — one package, one component, one dashboard toggle. Sets no cookies and stores no personal data, so there is no consent banner to build. Free on the current plan. |
| Google Analytics 4 | Free, but heavier, and it sets cookies — which means a consent banner on something being pitched to a university. More setup for data we do not need. |
| Plausible / Fathom | Good, privacy-first, and paid. No advantage here over what the host already provides. |
| Server logs | Free but useless: no notion of unique visitors, and the static assets are served from a CDN. |

**Why custom events at all.** The app is a single page whose surfaces are query parameters, so raw
page views would report one number and tell us nothing about *which* surface anyone used — the one
question this whole project exists to answer. Five events cover it:

| Event | Question it answers |
| --- | --- |
| `view_change` | Which of the five surfaces do people actually use? |
| `add_to_calendar` | Did anyone act on an event? (The core conversion.) |
| `subscribe` | Did anyone want the feed permanently? (The stickiness signal.) |
| `follow_interest` | Is the interest model right, and which interests win? |
| `install_pwa` | How many people put it on a home screen? |

**Deliberately small.** The free tier caps events per month, and a dashboard with forty event types
answers no question at all. Follows are tracked but not unfollows; search text is never sent.

**Nothing identifying is collected.** No user id, no search strings, no event titles. The only
values sent are fixed vocabulary from our own code — view ids, interest ids, and a calendar target.


---

## 18. Navigation: splitting one row of tabs into two labelled axes

**The problem, in the user's words:** *"I'd be confused how to explain this to someone, because
there's the Feed Discover Planner, then there's BYU website, then there's BYU app with the Feed
Discover month day."*

That is the whole diagnosis. The flat switcher — `BYU Website · BYU App · Feed · Discover ·
Planner` — had two defects that compounded:

1. **It collapsed two unrelated questions into one control.** "Where would this live?" is a
   decision for BYU. "How should events be arranged?" is a decision for students. Putting both in
   one row implied they were alternatives to each other, which they are not.
2. **The same word meant two things.** The BYU App surface had its own internal Feed / Discover /
   Month modes. So "Feed" was simultaneously a top-level surface *and* a mode inside a different
   top-level surface. No sentence was true about the whole bar.

The test a navigation scheme has to pass here is unusual and strict: the person who built it has
to be able to describe it out loud, in one breath, to a stranger on LinkedIn. The old one failed
that test, which is a product failure regardless of how well each individual surface worked.

**What we did.** Two named axes, printed as labels in the bar rather than left implicit:

```
WHERE THIS LIVES   [ Today's BYU Website ] [ Today's BYU App ] [ A purpose-built calendar ]
LAYOUT             [ List ] [ Cards ] [ Month ]

          Same 496 events and filters in all nine — pick where it lives and how it looks.
```

That last line is rendered in the switcher itself. It is the deliverable: if it is true and
legible, the nine combinations read as one idea instead of nine pages.

**Renames, and why.** `Feed → List`, `Discover → Cards`, `Planner → Month`. The old names were
brand words a student had to learn before they could express a preference, and `Feed` was the
collision. The new ones are self-describing, so the question "which do you prefer?" needs no
glossary — which matters when the answer is the data being collected.

**Every layout works in every placement.** Nine real combinations, not a ragged grid. This cost
real work — the BYU Website placement previously had exactly one layout — but an exception would
have reintroduced the thing we just removed: a tab that behaves unlike its neighbours and has to
be explained separately.

The faithful recreation of `calendar.byu.edu`'s own list is kept as the BYU Website placement's
**List** layout rather than being replaced by the generic one. That recreation is the evidence for
"this is your site today"; swapping it out would throw the evidence away to gain consistency
nobody asked for.

### Rejected alternatives

**Keep five tabs, just rename the app's internal modes.** Cheapest, and fixes the collision. But
it leaves a visitor needing to understand five unrelated surfaces before forming an opinion about
any of them, which was the actual complaint. Fixes the symptom, not the cause.

**One default layout plus a separate `/compare` page.** Genuinely tempting, and the least
confusing thing for a student. Rejected as the *primary* structure because the BYU-skin
placements are the entire pitch to leadership — demoting them to a secondary page optimises for
one audience by disabling the other. We took the idea anyway and added Compare alongside the
matrix, which turned out to be the better half of the suggestion.

**Separate deployments per design.** Rejected for the same reasons as the first time: three copies
of the ingest, taxonomy, filter engine and calendar export, three URLs for whoever is being
pitched, and preferences that do not follow you between them.

### What the default is now, and why it changed

The app used to open on the BYU Website recreation. It now opens on the purpose-built calendar.

Opening on the BYU skin meant the first thing a student saw was a faithful copy of the page they
already find inadequate, with every improvement one tab away. Leading with the purpose-built
surface shows the idea at full strength; the BYU skins then answer "but would it fit?", which is a
question BYU asks, not a question a student asks.

### Backward compatibility

The five retired ids plus the original `campus` are mapped onto cells of the matrix in
`LEGACY_VIEWS`, and read from `?view=`, `?design=`, and from `view` in existing localStorage. An
explicit `?placement=`/`?layout=` beats a legacy id when both appear. Links already shared
publicly keep working, and a returning student lands where they left off instead of being reset.

`day` — the BYU app's authentic single-day list — is deliberately *not* a fourth global layout,
since it would exist in only one placement. It stays reachable at `?placement=app&mode=day` so the
before/after can be shown in a pitch, and the About panel says so.

---

## 19. Comparison: three layouts at once

A switcher can only show one layout at a time, so comparing them is a memory test — click, scroll,
remember, click, scroll, try to recall how the first one felt. Asked for an opinion that way,
people reliably name the one they saw last.

**Compare** renders all three side by side with live data, each captioned with what it is good at,
each with "I prefer this" and "Open". Previews are capped in height and scrollable, so each column
shows its character without the page becoming three full-length feeds end to end.

Two details that are not obvious:

- **All three previews use the purpose-built chrome**, even when opened from a BYU placement. The
  question being asked is which *arrangement* reads best; wrapping each column in different chrome
  would change two variables at once and answer neither question.
- **Buttons inside previews are disabled, not the container.** `pointer-events-none` on the
  wrapper would also kill scrolling, and scrolling is how a layout gets judged. Without this, the
  per-event "Add to calendar" controls stay live and a stray click opens a menu on top of the
  comparison.

It also gives the project a single screenshot that communicates the whole idea, which a
one-at-a-time switcher structurally cannot produce.

---

## 20. Illustrative stand-in events

**The problem.** The headline feature is following the things you actually care about. Run the
ingest and ask what a student can actually follow: `hackathon` **0 events**, `conference`
**0 events**, and `clubs` is a single flat bucket of ~15 with no way to follow a named
association. The four examples the brief named — football, basketball, Product Management
Association, hackathons, dance — are *half unfilterable*. The feature demos as pointless, not
because it is pointless but because the public feed has no vocabulary for the things people want.

This is a chicken-and-egg problem, and both obvious answers are bad. Ship nothing and the most
important feature looks like a toy. Ship stand-ins quietly and the demo overstates what BYU's data
actually contains — in a pitch to the people who own that data, which is the worst possible
audience to mislead.

**What we did.** 20 stand-ins, every one labelled, with the labelling treated as load-bearing:

- `demo: true` on the record, `source: 'demo'`, and `url: null` — a stand-in never claims a real
  BYU page.
- A **DEMO** badge beside the title in every layout in every placement.
- Compact surfaces that cannot fit a badge get an equivalent: a dotted outline on month-grid chips,
  a hollow dot in the BYU app's month grid — because a filled dot still asserts that *something* is
  happening that day, and the grid must not silently inflate how busy a real day looks.
- A persistent amber banner on every surface naming the real count and the stand-in count.
- A dedicated section in the About panel explaining why they exist.
- Excluded from the headline figure everywhere. The number quoted publicly is **476 real events**.

**The clubs chosen are not invented from nothing.** They are ones BYU's own mobile app already
lists — Marketing Association, Pre-Nursing, Cybersecurity, Investment Banking — which is what makes
them evidence rather than decoration. Named clubs get their own interest group (`club-orgs`)
instead of being buried under `student-life`, because per-club granularity is precisely the
capability BYU's public feed lacks, and hiding it among `social` and `craft` would conceal the
thing being proposed.

**The guardrail.** The smoke suite enumerates all nine combinations and asserts each one labels
its stand-ins. This is not theoretical: the badge was first added by patching the first
`{event.title}` in each view, which silently missed the *second* card component in two of them —
so the Cards layout shipped stand-ins with no label at all until the enumerating test caught it.
The stand-ins are defensible only while they stay labelled, so that test is the thing keeping them
honest.

---

## 21. Feedback capture: Vercel Blob, one blob per response

**Why collect it in the product at all.** "Tell me what you think" on a social post returns a
handful of comments from people who already like you. Asking inside the product, right after
someone has used it, returns a number — and a number is what both a pitch and an interview need.
"64% of 71 students picked the list layout" is an argument; "people seemed to like it" is not.

**Storage.** Each response is its own small blob under `feedback/`. The alternatives and why they
lost:

| Option | Why not |
| --- | --- |
| One JSON file in storage | Read-modify-write. Two students submitting at once silently overwrite each other. |
| Free Postgres / Supabase | Auto-pauses after about a week idle and needs a *manual* restore. Responses would vanish weeks into a feedback window, exactly when nobody is watching. |
| Neon | Auto-resumes, so the pause problem is milder — but it is another provisioned service and connection budget for what is a handful of rows. |
| Google Form only | Reliable and zero-infra, but it asks people to leave the page, and response rates collapse. |

Blob is append-only by construction, so there is no race. Nothing pools connections, nothing needs
keeping warm, and nothing pauses. The cost is that aggregation means listing and reading N objects
rather than one query — a non-issue at tens-to-hundreds of responses, and the results endpoint
caps its read at 300 anyway.

**Recorded twice, on purpose.** A Blob write for the written comments, an analytics event for the
count. The count has to survive a storage failure; the comments cannot be reconstructed from a
count. Neither alone is sufficient, and the duplication is cheap.

**Privacy.** No name, email, sign-in, IP or user agent — not collected, not derived. The store is
private, so no response is reachable by URL. The comment box says so, because a student writing
criticism of their own university should not have to wonder.

**Reading it.** `/api/feedback-results?key=…` renders a self-contained HTML page: verdict split,
preferred-layout bars, who answered, and every comment. No client JavaScript, no build step, and
readable on a phone — which matters, because the moment he will want to check it is right after
posting the link. The key is compared in constant time and the page is `noindex`; the thing being
protected is the aggregate, since the responses are anonymous by construction.

**Asked late, asked once.** The bar appears after 25 seconds — long enough that someone has
actually looked at events — opens with a single thumbs-up/down, and only then asks the other three
questions. Dismissal and submission are both remembered locally. A four-field form up front gets
abandoned; one binary question costs nothing and earns the right to ask the rest.

---

## 22. Removing the install prompt

The PWA install banner has been removed. The manifest and offline service worker stay.

BYU already ships a mobile app, and one of the three placements is a proposal for *that app's*
calendar tab. Prompting a student to install a second, student-built app alongside it argues
against the pitch — the goal is to become part of BYU's products, not to compete with them for a
home-screen slot. "Installs to your phone like an app" was also about to go into a public post
about the project, where it would have muddied the ask.

What the service worker still earns: campus wifi is unreliable, and a cached shell means the
calendar opens in a building with bad signal. `/feed.ics` is never cached, because a stale
subscription silently stops updating. The smoke suite asserts that no install prompt creeps back.

---

## 23. Two bugs in the BYU App placement, and what caused them

Both were reported from the live site after §18 shipped, and both came from the same root: the
app recreation kept speaking its own private vocabulary after navigation became global.

### The header layout switcher looked broken

It was not broken — it changed state correctly. But the phone's own pill row rendered the *old*
names (`Day · Feed · Discover · Month`) while the header rendered the new ones
(`List · Cards · Month`). Pressing **List** in the header lit up **Feed** in the phone, so the two
controls visibly contradicted each other and the reasonable conclusion was that the header did
nothing.

Worse, the `Day` pill was genuinely dead. It mapped to no global layout, so `onModeChange('day')`
found no match and returned without changing anything. The same dead path fired when tapping a day
in the month grid, which also tried to switch to `day`.

**Fix.** The pill row is now generated from the same `LAYOUTS` registry the header uses, so the two
cannot drift — there is no second list of names to forget to update. Tapping a day in the month
grid opens a day panel *underneath the grid* instead of switching modes, which both removes the
dead path and is better behaviour anyway.

`day` is not a fourth global layout — it would exist in exactly one placement, which is the
exception §18 was written to eliminate. It stays reachable at `?mode=day` and renders as a
distinct amber **Day (today's app)** pill, so a pitch demo makes it obvious you are looking at what
BYU ships today rather than at the proposal.

**The part worth remembering.** `appMode` overrides the layout axis entirely while it is set, and
the *previous* build defaulted it to `'day'` and persisted it to localStorage. So anyone who used
the app surface before the rewrite came back with day mode silently pinned and both layout
switchers inert, with nothing in the UI explaining why. Two changes: `appMode` is no longer
restored from storage (it is a pitch escape hatch, not a preference), and `changeLayout` clears it
centrally — at the reducer rather than at one call site, so the header, the mobile sheet and
Compare cannot diverge.

A stale persisted value that disables a control is close to invisible in testing, because the
developer's own storage usually holds the new shape. It is worth asking, on any schema change to
saved preferences, what an *old* stored value now means.

### Filters opened a desktop drawer next to the phone

The shared filter sheet is `fixed inset-0` and slides in from the right edge of the browser
window. On the two web placements that is correct. On the phone placement it meant clicking the
funnel — a control drawn inside a phone someone is being asked to evaluate *as a phone* — threw a
laptop sidebar across the screen next to it. The interaction being demonstrated was not the
interaction being proposed, which defeats the point of rendering a device frame at all.

**Fix.** The phone frame is now `relative`, and on this placement filters render as an
`absolute inset-0` bottom sheet scoped to the frame: scrim, grabbable white sheet, a
*Show N events* button. The desktop drawer is suppressed for `placement === 'app'`. Both entry
points — the in-phone funnel and the header's *My interests* — open the same in-frame sheet, so
the scaffolding never contradicts the device.

### Regression cover

Enumerated, not spot-checked, for the same reason as §20: the smoke suite asserts the pill row
uses the global names, exposes no `Day` tab by default, marks the current layout for each of the
three layouts, labels the pinned day-only mode, and that the desktop drawer is suppressed while an
in-frame panel is supplied.
