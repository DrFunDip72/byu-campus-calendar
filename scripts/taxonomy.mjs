// Student-facing interest taxonomy.
//
// The BYU Calendar API gives us a `CategoryName` and `DeptNames`. Neither is a filter a student
// would actually want: nobody follows "Athletics", they follow *football*, and the single most
// common DeptNames value is "Ticketed Events", a publishing bucket. So we derive a second, finer
// layer of "interests" from the title, category, description and tags, and that is what the UI
// filters on. Categories stay available as a coarse fallback.
//
// Rules are ordered and a single event can carry several interests. Matching is deliberately
// conservative: an event with no rule hit keeps only its category-derived interest, never a guess.

export const INTEREST_GROUPS = [
  {
    id: 'athletics',
    label: 'Athletics',
    // Every sport rule scores 100% structural precision (`npm run audit`), and matching
    // descriptions or tags only added noise — a stray "Golf" tag had put the Homecoming Dance in
    // the golf feed. Sports are always named in the title.
    titleOnly: true,
    interests: [
      // Title format on the BYU calendar is reliably "<Sport> vs. <Opponent>", which is why these
      // rules can be this tight. The gendered variants are separate interests on purpose: a student
      // who follows women's volleyball should not get men's basketball in their feed.
      { id: 'football', label: 'Football', re: /\bfootball\b/i },
      { id: 'mens-basketball', label: "Men's Basketball", re: /\bmen.?s basketball\b/i },
      { id: 'womens-basketball', label: "Women's Basketball", re: /\bwomen.?s basketball\b/i },
      { id: 'volleyball', label: 'Volleyball', re: /\bvolleyball\b/i },
      { id: 'soccer', label: 'Soccer', re: /\bsoccer\b/i },
      { id: 'softball', label: 'Softball', re: /\bsoftball\b/i },
      { id: 'baseball', label: 'Baseball', re: /\bbaseball\b/i },
      { id: 'rugby', label: 'Rugby', re: /\brugby\b/i },
      { id: 'lacrosse', label: 'Lacrosse', re: /\blacrosse\b/i },
      { id: 'swim-dive', label: 'Swim & Dive', re: /swimming|diving/i },
      { id: 'track-xc', label: 'Track & Cross Country', re: /\btrack\b|cross country/i },
      { id: 'tennis', label: 'Tennis', re: /\btennis\b/i },
      { id: 'golf', label: 'Golf', re: /\bgolf\b/i },
      { id: 'gymnastics', label: 'Gymnastics', re: /gymnastics/i }
    ]
  },
  {
    id: 'arts',
    label: 'Arts & Performance',
    interests: [
      { id: 'dance', label: 'Dance', re: /\bdance\b|ballroom|ballet|folk dance|clogging|dancesport/i },
      { id: 'theatre', label: 'Theatre', re: /theatre|theater|\bmusical\b|\bopera\b/i },
      { id: 'film', label: 'Film & Screenings', re: /\bfilm\b|screening|cinema|documentar/i },
      { id: 'music', label: 'Music & Concerts', re: /concert|orchestra|symphony|choir|chorale|recital|\bjazz\b|a cappella|\bsingers\b/i },
      // Structural. These are place words, so free-text matching filed 31 FHE scavenger hunts and
      // Craft Nights here purely because they were held "at the Education in Zion Gallery".
      // Matching the location field instead made it worse, not better — those events really are in
      // a gallery. Browsing *by venue* is what the organization filter is for; an interest should
      // be topical, and a real exhibit names itself.
      { id: 'visual-arts', label: 'Visual Arts & Museums', re: /\bmuseum\b|exhibit|gallery|\bMOA\b/i, scope: 'structural' }
    ]
  },
  {
    id: 'career',
    label: 'Career & Academics',
    interests: [
      { id: 'career-fair', label: 'Career & Job Fairs', re: /\b(career|job|internship|grad(uate)? school|major)\s*(fair|expo)\b/i },
      { id: 'hackathon', label: 'Hackathons', re: /hackathon|hack-a-thon|\bhack night\b|code jam|datathon/i },
      { id: 'info-session', label: 'Employer Info Sessions', re: /info(rmation)? session|recruit(ing|er)|employer (panel|session)|tech talk/i },
      { id: 'lecture', label: 'Lectures & Symposia', re: /lecture|symposium|colloquium|seminar|keynote|panel discussion/i },
      { id: 'conference', label: 'Conferences', re: /conference|summit|convention/i },
      // Structural: all 20 description matches were false positives. The Harold B. Lee Library
      // boilerplate mentions "research", which filed every Craft Night as a research event. A real
      // research event names it in the title.
      { id: 'research', label: 'Research', re: /research|thesis defense|dissertation|poster session/i, scope: 'structural' },
      { id: 'study-abroad', label: 'Study Abroad', re: /study abroad|international internship|global engagement/i },
      { id: 'workshop', label: 'Workshops & Skills', re: /workshop|\btraining\b|\b101\b|bootcamp/i }
    ]
  },
  {
    id: 'student-life',
    label: 'Student Life',
    interests: [
      { id: 'fhe', label: 'FHE', re: /\bFHE\b|family home evening/i },
      { id: 'clubs', label: 'Clubs & Organizations', re: /\bclubs?\b|\bassociation\b|\bsociety\b|chapter meeting|BYUSA/i },
      { id: 'social', label: 'Socials & Food', re: /\bsocial\b|\bparty\b|mingle|meet (and|&) greet|game night|\bskate\b|smores|\bs.mores\b|\blunch\b|\bbreakfast\b|\bdinner\b/i },
      { id: 'craft', label: 'Crafts & Making', re: /craft|\bDIY\b|make your own|pottery|sewing|sketching/i },
      { id: 'service', label: 'Service & Volunteering', re: /service project|volunteer|blood drive|food drive|fundrais/i },
      { id: 'outdoors', label: 'Outdoors & Recreation', re: /\bhike\b|hiking|outdoor|intramural|\bclimb/i },
      { id: 'devotional', label: 'Devotionals & Forums', re: /devotional|\bforum\b|fireside/i },
      { id: 'wellness', label: 'Health & Wellness', re: /wellness|mental health|counsel|\byoga\b|fitness|nutrition|flu shot/i },
      // Structural for the same reason: the film archive sits inside the library, so looser
      // matching filed classic-film screenings under Library & Study. Browsing everything held at
      // the library is the "Harold B. Lee Library" organization filter's job.
      { id: 'library', label: 'Library & Study', re: /\blibrary\b|\bHBLL\b|study (hall|session|night)/i, scope: 'structural' },
      { id: 'homecoming', label: 'Homecoming & Traditions', re: /homecoming|true blue|light the y|\bY mountain\b/i }
    ]
  },
  {
    // Added once `categories=all` surfaced the Academic Calendar department: 69 events that had
    // been falling into the catch-all were holidays, finals, term boundaries and commencement.
    // "When is Thanksgiving break" and "when do finals start" are among the most common things a
    // student actually needs from a campus calendar, so these get real filters.
    id: 'academic',
    label: 'Academic Dates',
    // `titleOnly` matters here. These interests describe what an event *is* structurally, not what
    // it is about, so matching their keywords inside a description produces nonsense: the Lens and
    // Light film series lists its whole season in every event's description, including "White
    // Christmas", which tagged six film screenings as campus holidays. A holiday is a holiday
    // because of its title, not because a film in it mentions one.
    titleOnly: true,
    // Even on titles alone, "Symphony Orchestra: Joy of Christmas" and "Tuba Christmas" matched
    // `holidays` — but a student filtering Holidays & Breaks wants to know when campus is *closed*,
    // not to find a Christmas concert. A category blocklist does not solve it either, because those
    // concerts come through the "School of Music" department category.
    //
    // The discriminator that actually works is structural: an administrative date record has no
    // start time. "Thanksgiving" and "Final Exam Day" are all-day or midnight; a concert is at
    // 7:30 pm. So this group only matches timeless events.
    timelessOnly: true,
    interests: [
      { id: 'finals', label: 'Finals & Exams', re: /final exam|exam preparation|last day of class|\bfinals\b|reading day/i },
      { id: 'holidays', label: 'Holidays & Breaks', re: /holiday|thanksgiving|christmas|new year|martin luther king|presidents day|\bno classes\b|spring break|labor day|independence day|pioneer day/i },
      { id: 'term-dates', label: 'Term Start & End', re: /start of classes|first day of|last day of \d|first day of \d|end of term|monday instruction|\bterm\b begins/i },
      { id: 'deadline', label: 'Deadlines', re: /deadline|\bdue date\b|registration (opens|closes)|applications? close|withdraw/i },
      { id: 'graduation', label: 'Graduation', re: /commencement|convocation|graduation/i },
      { id: 'orientation', label: 'Orientation', re: /new student orientation|\borientation\b/i },
      { id: 'grades', label: 'Grades', re: /grades online|grade (posting|report)/i }
    ]
  }
];

// Fallback when no keyword rule fires, so every event is still reachable from some filter.
const CATEGORY_FALLBACK = {
  Athletics: 'other-athletics',
  'Arts & Entertainment': 'other-arts',
  'Student Life': 'other-student-life',
  Education: 'lecture',
  Conferences: 'conference',
  'Major Conferences': 'conference',
  'Devotionals & Forums': 'devotional',
  'Health & Wellness': 'wellness',
  Other: 'other'
};

export const FALLBACK_INTERESTS = [
  { id: 'other-athletics', label: 'Other Athletics', group: 'athletics' },
  { id: 'other-arts', label: 'Other Arts Events', group: 'arts' },
  { id: 'other-student-life', label: 'Other Student Life', group: 'student-life' },
  { id: 'other-academic', label: 'Other Academic Dates', group: 'academic' },
  { id: 'other', label: 'Everything Else', group: 'student-life' }
];

// "Programs at 7:00 and 7:30 PM" should not read as a PM/product mention, and a "$10" price should
// not feed the keyword matcher. Clock times and prices are stripped before matching.
const NOISE_RE = /\b\d{1,2}([:.]\d{2})?\s*[ap]\.?\s?m\.?\b|\$\d+(\.\d+)?/gi;

/** The nine main categories. Anything else in CategoryName is a department/group category. */
export const MAIN_CATEGORIES = new Set([
  'Education',
  'Conferences',
  'Major Conferences',
  'Devotionals & Forums',
  'Arts & Entertainment',
  'Athletics',
  'Health & Wellness',
  'Student Life',
  'Other'
]);

export function deriveInterests(event) {
  // The category name joins the haystack because `categories=all` surfaces events whose primary
  // category is a department ("School of Music", "BRAVO! Events"). Without it, "OcTUBAfest" matches
  // no keyword rule and lands in the catch-all; with it, "School of Music" matches the music rule.
  // Every main category name is also either inert or correct here ("Health & Wellness" -> wellness,
  // "Devotionals & Forums" -> devotional), so this never mis-tags.
  const haystack = `${event.title} ${event.tags.join(' ')} ${event.category} ${event.description}`.replace(
    NOISE_RE,
    ' '
  );
  // Three matching scopes, narrowest first:
  //   structural — title + category. The fields that say what an event *is*.
  //   haystack   — everything, including tags and the description. The default.
  // A group can set `titleOnly` to put all of its interests in `structural`; a single interest can
  // override with `scope`. Both exist because the audit showed the right scope differs per rule:
  // sports are always in the title, "gallery" is usually a venue, "research" is boilerplate.
  const structural = `${event.title} ${event.category}`.replace(NOISE_RE, ' ');
  const SCOPES = { structural };
  // An administrative date record carries no meaningful clock time: either the all-day flag is set,
  // or the API reports it at midnight.
  const timeless = event.allDay === true || /T00:00(:00)?/.test(String(event.start ?? ''));

  const found = [];
  for (const group of INTEREST_GROUPS) {
    if (group.timelessOnly && !timeless) continue;
    const groupText = group.titleOnly ? structural : haystack;
    for (const interest of group.interests) {
      // Throwing on an unknown scope is deliberate. An earlier version silently handed `undefined`
      // to the matcher, which quietly dropped two interests to zero events rather than failing —
      // and a classifier that returns nothing looks exactly like a campus with nothing scheduled.
      if (interest.scope && !(interest.scope in SCOPES)) {
        throw new Error(`Interest "${interest.id}" has unknown scope "${interest.scope}"`);
      }
      const text = interest.scope ? SCOPES[interest.scope] : groupText;
      if (interest.re.test(text)) found.push(interest.id);
    }
  }
  if (!found.length) found.push(CATEGORY_FALLBACK[event.category] ?? 'other');
  return [...new Set(found)];
}

// DeptNames values that are publishing buckets rather than real campus organizations. Showing
// "Ticketed Events" as the host of a film screening is worse than showing nothing, and it is the
// single most common value in the feed (234 of 623), so it would dominate any "follow an org" list.
const NOISE_ORGS = new Set([
  'Ticketed Events',
  'Featured Events - Main',
  'Other Events',
  'Main Calendar',
  'Student Financial Deadlines',
  // A delivery method, not a host. Appears on 15 events since the switch to `categories=all`.
  'STREAMING'
]);

// "Suggested - Music", "Suggested - Bravo", "Suggested - Dance" are homepage placement buckets.
// Matching them by prefix means new ones do not have to be added to the list by hand.
const isNoiseOrg = (name) => NOISE_ORGS.has(name) || name.startsWith('Suggested - ');

export function deriveOrgs(event, rawDepts) {
  const orgs = rawDepts.filter((d) => d && !isNoiseOrg(d));
  if (orgs.length) return orgs;
  // Athletics events carry no useful DeptNames at all, so the host is inferred from the category.
  if (event.category === 'Athletics') return ['BYU Athletics'];
  // A non-main CategoryName *is* a department or group category ("School of Music", "BRAVO!
  // Events"), which makes it a better host name than nothing. This is the main reason the switch
  // to `categories=all` also widened the organization list.
  if (event.category && !MAIN_CATEGORIES.has(event.category)) return [event.category];
  return [];
}
