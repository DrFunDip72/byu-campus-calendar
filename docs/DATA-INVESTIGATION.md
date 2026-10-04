# Investigation: are PMA and hackathon events available from the API?

**Question asked:** the Hackathons and Product Management Association filters show zero events.
Was the data hardcoded instead of pulled from the API endpoint?

**Short answer:** nothing was hardcoded — but the ingest *was* under-pulling the API by ~55%, for a
different reason, and that is now fixed. PMA and hackathon events are genuinely not in the BYU
calendar API at all, which is a BYU data-publishing gap rather than a bug in this project.

---

## 1. Was anything hardcoded? No.

Verified directly:

- `grep` for `hackathon|product management|PMA` across all source files returns only taxonomy rules,
  comments and test assertions — **no event records**.
- Every event in the snapshot carries a `source` id, and all of them are `byu_calendar`, `cs_dept`,
  or the merge of the two.
- **0** events have a `url` outside a `*.byu.edu` domain.

The snapshot is a build artifact of `scripts/fetch-events.mjs`, regenerated from the live API. It is
committed (see `docs/DECISIONS.md` §3 for why), which can look like hardcoded data, but it is
reproducible from scratch with `npm run refresh`.

## 2. The real bug: a ~55% undercount, failing silently

Reading BYU's own API documentation at `calendar.byu.edu/byu-calendar-api-documentation` turned up
two things the previous implementation had wrong.

### `/api/Categories` returns only *main* categories

The docs are explicit:

> This API exists to get all categories, because Categories API previously returned all categories,
> but now it returns only main categories.

There are three category types — **main categories, tags, and internal categories (departments and
groups)**. The ingest was passing the nine main category ids explicitly.

### The Events API accepts `categories=all`, and it is not equivalent

The docs claim it should be:

> You can also specify "all" to include all categories. Including all main categories means to
> include all events (as one main level category is required for all events).

**That claim is false in practice.** Measured on the same one-week window:

| Request | Events |
| --- | --- |
| `categories=4+1006+7+9+10+47+49+52+6` (nine main ids) | 35 |
| `categories=all` | 40 |

The five extras had a **non-main category as their primary category**, so requesting every main
category did not reach them:

| Event | Primary category |
| --- | --- |
| Jazz Showcase | School of Music |
| Fall Choral Showcase | School of Music |
| OcTUBAfest | School of Music |
| Emmet Cohen presents Miles and Coltrane at 100 | BRAVO! Events |
| 1st Term Withdraw Deadline | Academic Calendar |

Across the full window this is the difference between **404 and 642 raw records**. Worse, it failed
*silently* — the response was a valid 200 with a plausible number of events.

### What the fix changed

| | Before | After |
| --- | --- | --- |
| Raw records pulled | 404 | 642 |
| Unique events after de-duplication | 385 | 623 |
| Organizations identified | 7 | 11 |
| Interests in use | 32 | 38 |

New organizations now visible: **School of Music** (179 music events), **Academic Calendar**,
**BRAVO! Events**, **Faculty Recitals**.

### A second finding that came out of it

The newly-reachable `Academic Calendar` department contributed 69 events that all fell into the
catch-all interest: finals, holidays, term boundaries, commencement, orientation, grades. "When is
Thanksgiving break" and "when do finals start" are among the most common things a student needs from
a campus calendar, so these got a new **Academic Dates** interest group (Finals & Exams, Holidays &
Breaks, Term Start & End, Deadlines, Graduation, Orientation, Grades). The catch-all dropped from
**69 events to 8**.

Two further changes were needed to handle the wider pull:

- The **category name now feeds the keyword classifier**. Without it "OcTUBAfest" matches no rule;
  with it, its `School of Music` category matches the music rule. Every main category name is either
  inert or correct here, so this cannot mis-tag.
- A **non-main `CategoryName` is used as the host organization** when `DeptNames` has nothing usable,
  which is where "School of Music" and "BRAVO! Events" as org names come from. `Suggested - *`
  placement buckets and `STREAMING` are filtered out as noise.

## 3. PMA and hackathons are not in the API

Searched the **full 365-day pull with `categories=all`** — 626 raw records — across `Title`,
`Description`, `ShortDescription`, `TagsNames`, `DeptNames` and `CategoryName`:

| Pattern | Matches |
| --- | --- |
| `hackathon\|hack-a-thon\|datathon\|code jam` | **0** |
| `product management\|PMA\|product manager` | **0** |

So the zero counts were accurate. The complete list of departments that publish to the API is 15
values, of which 11 are real organizations — and not one is a student club or association.

This is consistent with the prior hackathon project, which found a real hackathon
(`homecoming-hackathon-2026-10-02`) on **cs.byu.edu**, not on the main calendar.

## 4. Where those events actually live, and what it would take

| Source | What it has | Why it is not wired up |
| --- | --- | --- |
| **cs.byu.edu** | Department events incl. hackathons | ✅ **Already ingested.** Each event page links a structured `.ics` file. Currently 2 events. |
| **marriott.byu.edu/event** | Marriott School club and association events — the likely home of PMA | Per-event HTML pages with **no ICS, no JSON-LD, no feed**, and dates not in parseable plain text. Needs a bespoke per-page scraper or an LLM extraction step. Fragile. |
| **clubs.byu.edu** | The official Student Organizations directory | A **Mendix** single-page app (`mxclientsystem/mxui.js`). No public REST API; data arrives over a proprietary client protocol. Not practically scrapeable. |
| **CougarConnect / CampusLabs** | Club events at many universities | BYU does not appear to expose the standard Engage discovery API — `byu.campuslabs.com/engage/*` returns 404. |

**The important point for the pitch:** BYU already operates the pipe. `calendar.byu.edu` has a
public **Submit an Event** form, and the API docs note that a department can publish through the BYU
Calendar system while choosing not to display on `calendar.byu.edu`
(the `IsPublishedNotMainCalendar` field exists for exactly this). So clubs *could* publish into the
system this project already reads. The gap is adoption and policy, not technology.

The ask is therefore concrete and cheap: **get clubs and colleges publishing into the calendar
system BYU already runs**, and this calendar fills in with no further engineering.

## 5. One endpoint is broken from here

`https://calendar.byu.edu/api/AllCategories` (both `.json` and `.xml`) **timed out on every
attempt** — three tries at 90 seconds each, connection never completed. `/api/Categories`,
`/api/CategoryCounts` and `/api/Events` all respond normally, so this is specific to that route.
Not blocking — `categories=all` on the Events API gives us what we needed — but worth reporting to
BYU, since it is a documented endpoint that appears non-functional.
