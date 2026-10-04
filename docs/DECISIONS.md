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
| **Club and association events** | Not published to the BYU calendar system at all. `clubs.byu.edu` is a Mendix SPA with no public API; Marriott's club events are per-event HTML with no feed. **Verified: 0 matches for hackathon or PMA across 626 records / 365 days.** | **The biggest gap.** It is why "Hackathons" and "Study Abroad" show zero. See [`DATA-INVESTIGATION.md`](DATA-INVESTIGATION.md) for every source probed. BYU already runs a public "Submit an Event" form, so the pipe exists — the gap is adoption, not technology. |
| **Most college/department calendars** | Only 11 organizations publish a usable host name to the API. | CS is wired up to prove per-department sources merge cleanly. Each other college needs the same ~40 lines. |
| **Intramurals, Y-Serve** | Separate systems. | Significant student-life volume missing. |
| **A student's class schedule** | Needs BYU sign-in. | Highest-value *addition*: it would let the calendar hide events that collide with classes. |

**The ask this implies:** the pipeline is built and working. What it needs from BYU is source
access — chiefly a club-events feed — not more engineering.

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

## 6. Four designs, one engine

The four layouts are **presentation only**. Data, search, filtering, preferences, and calendar
export are identical and shared. A decision between them is a decision about students, not features.

| | **BYU.edu** (default) | **Feed** | **Discover** | **Planner** |
| --- | --- | --- | --- | --- |
| **Thesis** | "What would this look like on our site?" | "What's on today?" | "Show me something good" | "What does my month look like?" |
| **Form** | Recreation of calendar.byu.edu: navy section bars, carousel rows of promo cards | Dense day-grouped list, fixed time gutter, 56px thumbnails | Image-led cards, featured lead, horizontal rails | Month grid + sticky day panel |
| **Events per screen** | ~3 per row, rows stacked | ~12 | ~4 | ~30 (titles only) |
| **Best at** | Showing leadership the idea inside their own design system | Answering a specific question fast | Discovery; serendipity | Density, conflicts, planning |
| **Worst at** | Density — a carousel hides most of the row behind a click | Making an unknown event look appealing | Information density; favours events with good artwork | Discovery; needs real screen width |
| **Would suit** | The actual calendar.byu.edu home page | The default for a logged-in student | A homepage, or digital signage | A planning tool, or an advisor's view |

**Why BYU.edu is the default:** this build's first job is a pitch. Opening on BYU's own layout makes
the first question "should we do this" rather than "would this fit our site". The other three then
show what becomes possible once the data is unified.

**Why Feed is the best default for students:** most real visits are a specific question with time
pressure behind it. Discovery is the second visit, not the first.

### The BYU.edu design is matched, not approximated

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

**Why all four are always visible in the header**, rather than one shipping and three in a deck:
the point of this build is to let people compare them against real data in one sitting.

---

## 7. Preferences: no login

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

## 8. Calendar export: the feature that makes it stick

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

## 9. Time zones

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

## 10. De-duplication across sources

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

## 11. Visual design

Not a guess from a screenshot — the values are taken from BYU's own systems:

- **Navy `#002E5D`** — BYU's primary colour.
- **Royal `#0047BA`** — read straight out of the calendar API payload, which ships its own theme
  fields (`primaryLinkColor`, `headerDividerColor`, `buttonBgColor1` all return `#0047ba`).
- **IBM Plex Sans / Serif** — the API payload returns `bodyFont: "IBM Plex Sans"`.

**Category accent colours are ours, not BYU's**, and are flagged as such: the Planner grid needs
eight visually separable chips and navy-on-navy is unreadable. Each is darkened to hold at least
4.5:1 against white.

---

## 12. Testing

No browser automation was available, so `scripts/smoke.mjs` server-renders the real `App` against
the real snapshot through `react-dom/server` and asserts behaviour, not just absence of crashes
(29 checks):

- all four designs render, each with its own chrome, and each still offers the layout switcher
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

## 13. What we would do next, in order

1. **Get a club-events source.** Largest coverage gap by far; everything else is polish.
2. **BYU sign-in** → class-schedule conflict detection ("you have class then"), cross-device sync.
3. **Notifications** for followed interests, opt-in, digest rather than per-event.
4. **Submit-an-event** form for clubs with no feed at all, with light moderation.
5. **Analytics on follows** — which interests students actually pick is a dataset BYU does not
   currently have, and it would inform programming decisions, not just this product.
