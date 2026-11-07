/**
 * Merges a small set of clearly-badged stand-in events into the snapshot.
 *
 * WHY THIS EXISTS
 * ---------------
 * BYU's public calendar API has no vocabulary for most of what a student actually wants to follow.
 * A raw pull gives: `hackathon` 0 events, `conference` 0 events, and a single undifferentiated
 * `clubs` bucket of ~15 — no way to follow the Product Management Association specifically, or any
 * other named club, because named clubs are not in the public feed at all. BYU's *own mobile app*
 * has a Club field and carries these events; the public endpoint does not expose it.
 *
 * That gap is the finding the whole pitch rests on. But a demo that cannot demonstrate interest
 * filtering also cannot sell interest filtering, so there is a chicken-and-egg problem: the most
 * important feature has almost nothing real to act on.
 *
 * The resolution is to add stand-ins and label them, rather than to add nothing (feature looks
 * pointless) or to add them silently (demo overstates the data). Every event here carries
 * `demo: true`, renders a DEMO badge wherever it appears, is counted separately in the About
 * panel, and is excluded from the headline "real events" number.
 *
 * Run after `npm run refresh`; `npm run build:data` does both in order.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SNAPSHOT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/events.json');

/**
 * Named clubs become their own interest group rather than new entries under `student-life`.
 *
 * This is the point of the demo: the thing BYU's feed cannot express is *per-club* granularity.
 * Burying these among `social` and `craft` would hide exactly the capability being proposed, so
 * they get a group of their own where the interest panel shows them as a block.
 */
const CLUB_GROUP = {
  id: 'club-orgs',
  label: 'Clubs & associations',
  interests: [
    { id: 'club-pma', label: 'Product Management Association' },
    { id: 'club-cyber', label: 'Cybersecurity Student Association' },
    { id: 'club-ib', label: 'Investment Banking Association' },
    { id: 'club-marketing', label: 'Marketing Association' },
    { id: 'club-prenursing', label: 'Pre-Nursing Association' },
    { id: 'club-aiml', label: 'AI & Machine Learning Club' },
    { id: 'club-ballroom', label: 'Ballroom Dance Club' }
  ]
};

/** Mountain Standard Time for the whole seeded window (DST ended 2026-11-01). */
const TZ = '-07:00';

const at = (day, time) => `2026-${day}T${time}:00${TZ}`;

/**
 * Deliberately mundane. These are stand-ins for the *shape* of club programming — workshops,
 * speaker nights, socials, case competitions — not predictions of real events, and they name no
 * real people.
 *
 * [day, start, end, title, location, org, interests, category, description]
 */
const DEMO = [
  // --- Product Management Association: the named example from the brief ---
  ['11-12', '18:00', '19:30', 'PMA: Breaking Into Product Management', 'Tanner Building W110',
    'Product Management Association', ['club-pma', 'info-session'], 'Student Life',
    'A panel of recent graduates now working as associate product managers walk through how they got there — internships, case prep, and what a PM actually does day to day. Pizza provided.'],
  ['11-19', '18:00', '19:30', 'PMA: Product Case Workshop', 'Tanner Building W238',
    'Product Management Association', ['club-pma', 'workshop'], 'Student Life',
    'Work a real product case in small groups with feedback from club officers who have interned in PM roles. Bring a laptop.'],
  ['12-03', '17:30', '20:00', 'PMA Fall Case Competition', 'Tanner Building Lobby',
    'Product Management Association', ['club-pma', 'conference'], 'Student Life',
    'Teams of three pitch a product strategy to a judging panel. Open to all majors; no prior PM experience needed.'],

  // --- Hackathons: the interest with zero real events in the public feed ---
  ['11-14', '17:00', null, 'Cougar Hacks: 36-Hour Hackathon', 'Engineering Building Atrium',
    'Cougar Hacks', ['hackathon', 'club-aiml'], 'Education',
    'Build anything in 36 hours. Teams of up to four, hardware lab open all night, mentors from local startups on site. Beginner track available.'],
  ['11-07', '19:00', '20:00', 'Cougar Hacks Info Session & Team Forming', 'Talmage Building 1170',
    'Cougar Hacks', ['hackathon', 'info-session'], 'Education',
    'What to expect, how judging works, and time to find teammates if you are coming solo.'],
  ['12-05', '09:00', '18:00', 'AI/ML Club: Model Build Day', 'Crabtree Building 230',
    'AI & Machine Learning Club', ['club-aiml', 'hackathon', 'workshop'], 'Education',
    'A one-day sprint fine-tuning small models on a shared dataset. Compute provided; bring your own problem.'],

  // --- Clubs BYU's own app lists but the public API does not expose ---
  ['11-11', '18:30', '20:00', 'Cybersecurity Association: Capture the Flag Night', 'Crabtree Building 101',
    'Cybersecurity Student Association', ['club-cyber', 'workshop'], 'Education',
    'A beginner-friendly CTF run on club infrastructure. Walkthroughs for the first two challenges, then you are on your own.'],
  ['11-25', '18:00', '19:30', 'Cybersecurity Association: Résumé & Clearance Q&A', 'Crabtree Building 101',
    'Cybersecurity Student Association', ['club-cyber', 'career-fair'], 'Education',
    'How security résumés get screened, and what a clearance process actually involves.'],
  ['11-13', '17:00', '18:30', 'Investment Banking Association: Technical Prep', 'Tanner Building W320',
    'Investment Banking Association', ['club-ib', 'workshop'], 'Student Life',
    'Walkthrough of the accounting and valuation questions that come up in first-round interviews.'],
  ['12-02', '18:00', '19:30', 'IBA: Spring Recruiting Timeline', 'Tanner Building W320',
    'Investment Banking Association', ['club-ib', 'info-session'], 'Student Life',
    'When applications open, which banks recruit on campus, and how to prepare over the break.'],
  ['11-18', '18:00', '19:00', 'Marketing Association: Brand Teardown Night', 'Tanner Building W214',
    'Marketing Association', ['club-marketing', 'workshop'], 'Student Life',
    'Pick a campaign apart live — positioning, channel mix, and what the team would have done differently.'],
  ['12-04', '17:30', '19:00', 'Marketing Association: Portfolio Reviews', 'Tanner Building W214',
    'Marketing Association', ['club-marketing', 'career-fair'], 'Student Life',
    'Bring a case study or campaign and get it reviewed by officers and an alumni mentor.'],
  ['11-20', '18:00', '19:30', 'Pre-Nursing Association: Application Night', 'Kimball Tower 140',
    'Pre-Nursing Association', ['club-prenursing', 'info-session'], 'Health & Wellness',
    'Clinical hour requirements, the application timeline, and a Q&A with students currently in the program.'],

  // --- Dance: a named example. Real `dance` events exist but are all ticketed concerts. ---
  ['11-15', '20:00', '23:00', 'Ballroom Club: Fall Social Dance', 'Wilkinson Student Center Ballroom',
    'Ballroom Dance Club', ['club-ballroom', 'dance', 'social'], 'Student Life',
    'Open social dance — no partner and no experience needed. Free lesson at 7:30pm covers the basics of foxtrot and swing.'],
  ['12-06', '20:00', '23:00', 'Ballroom Club: Winter Formal Social', 'Wilkinson Student Center Ballroom',
    'Ballroom Dance Club', ['club-ballroom', 'dance', 'social'], 'Student Life',
    'Semi-formal social dance to close the semester. Lesson at 7:30pm, open dancing after.'],
  ['11-21', '19:00', '21:00', 'Swing Night: Live Student Band', 'Wilkinson Student Center Ballroom',
    'Ballroom Dance Club', ['club-ballroom', 'dance', 'social'], 'Student Life',
    'Social swing dancing to a live student band. Beginner lesson at 6:30pm.'],

  // --- Athletics: football is genuinely out of season in November, so that gap is real ---
  ['12-19', '13:30', '17:00', 'Football: Bowl Game Watch Party', 'Wilkinson Student Center Terrace',
    'BYU Athletics', ['football', 'social'], 'Athletics',
    'Watch party on the big screen with free hot chocolate. Open to students; families welcome.'],

  // --- Student life odds and ends, so the non-club interests look lived-in ---
  ['11-10', '19:00', '20:30', 'Intramural Sign-Up & Captains Meeting', 'Smith Fieldhouse 131',
    'BYU Intramurals', ['other-student-life', 'social'], 'Student Life',
    'Winter season sign-ups for basketball, indoor soccer and volleyball. Captains must attend or send a proxy.'],
  ['11-26', '11:00', '13:00', 'Service Council: Thanksgiving Meal Packing', 'Wilkinson Student Center 3220',
    'BYU Service Council', ['service', 'social'], 'Student Life',
    'Pack meal boxes for distribution to families in Provo. Drop in any time during the two-hour window.'],
  ['12-11', '20:00', '22:00', 'Finals Week Late-Night Study Breakfast', 'Cannon Center',
    'BYUSA', ['social', 'finals'], 'Student Life',
    'Free breakfast served at 10pm during finals week. Student ID required.']
];

const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));

// Idempotent: drop any previously seeded events before re-seeding, so running this twice does not
// duplicate the set, and a fresh `refresh` that already cleared them is handled identically.
const real = snapshot.events.filter((e) => !e.demo);

const seeded = DEMO.map(
  ([day, startTime, endTime, title, location, org, interests, category, description], i) => ({
    id: `demo:${String(i + 1).padStart(3, '0')}`,
    title,
    start: at(day, startTime),
    end: endTime ? at(day, endTime) : null,
    allDay: false,
    location,
    category,
    tags: ['Demo'],
    orgs: [org],
    interests,
    description,
    summary: description.length > 120 ? `${description.slice(0, 117)}...` : description,
    image: null,
    imageAlt: null,
    url: null,
    ticketsUrl: null,
    free: true,
    priceLow: 0,
    priceHigh: 0,
    source: 'demo',
    demo: true
  })
);

const events = [...real, ...seeded].sort((a, b) => a.start.localeCompare(b.start));

// Recount interests across the merged set so the interest panel's live counts stay truthful.
const interestCounts = {};
for (const e of events) {
  for (const id of e.interests) interestCounts[id] = (interestCounts[id] ?? 0) + 1;
}

// The club group is appended rather than inserted, so the real BYU-derived groups keep leading the
// panel and the demo block reads as an addition to BYU's taxonomy — which is what it proposes.
const groups = [...snapshot.groups.filter((g) => g.id !== CLUB_GROUP.id), CLUB_GROUP];

const orgs = [...new Set(events.flatMap((e) => e.orgs))].sort((a, b) => a.localeCompare(b));

const out = {
  ...snapshot,
  demoCount: seeded.length,
  sources: [
    ...snapshot.sources.filter((s) => s.id !== 'demo'),
    { id: 'demo', label: 'Illustrative stand-ins', url: '', count: seeded.length }
  ],
  groups,
  orgs,
  interestCounts,
  events
};

writeFileSync(SNAPSHOT, `${JSON.stringify(out)}\n`);

console.log(`Seeded ${seeded.length} demo events alongside ${real.length} real ones.`);
console.log(`  clubs now followable individually: ${CLUB_GROUP.interests.length}`);
console.log(
  `  hackathon: ${interestCounts.hackathon ?? 0}  dance: ${interestCounts.dance ?? 0}  football: ${interestCounts.football ?? 0}  clubs: ${interestCounts.clubs ?? 0}`
);
