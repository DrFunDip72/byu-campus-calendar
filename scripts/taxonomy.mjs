// Student-facing interest taxonomy.
//
// The BYU Calendar API gives us a `CategoryName` (9 values, e.g. "Athletics") and `DeptNames`
// (10 distinct values across a 180-day window, mostly "Ticketed Events"). Neither is a filter a
// student would actually want: nobody follows "Athletics", they follow *football*. So we derive a
// second, finer layer of "interests" from the title, description and tags, and that is what the UI
// filters on. Categories stay available as a coarse fallback.
//
// Rules are ordered and a single event can carry several interests. Matching is deliberately
// conservative: an event with no rule hit keeps only its category-derived interest, never a guess.

export const INTEREST_GROUPS = [
  {
    id: 'athletics',
    label: 'Athletics',
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
      { id: 'visual-arts', label: 'Visual Arts & Museums', re: /\bmuseum\b|exhibit|gallery|\bMOA\b/i }
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
      { id: 'research', label: 'Research', re: /research|thesis defense|dissertation|poster session/i },
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
      { id: 'library', label: 'Library & Study', re: /\blibrary\b|\bHBLL\b|study (hall|session|night)|\bfinals\b/i },
      { id: 'deadline', label: 'Deadlines & Dates', re: /deadline|\bdue date\b|registration (opens|closes)|applications? close/i },
      { id: 'homecoming', label: 'Homecoming & Traditions', re: /homecoming|true blue|light the y|\bY mountain\b/i }
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
  { id: 'other', label: 'Everything Else', group: 'student-life' }
];

// "Programs at 7:00 and 7:30 PM" should not read as a PM/product mention, and a "$10" price should
// not feed the keyword matcher. Clock times and prices are stripped before matching.
const NOISE_RE = /\b\d{1,2}([:.]\d{2})?\s*[ap]\.?\s?m\.?\b|\$\d+(\.\d+)?/gi;

export function deriveInterests(event) {
  const haystack = `${event.title} ${event.tags.join(' ')} ${event.description}`.replace(NOISE_RE, ' ');
  // The title is matched on its own as well, so a rule that only appears in a long description
  // still counts but never outranks the title. Both feed the same set.
  const titleOnly = String(event.title).replace(NOISE_RE, ' ');
  const found = [];
  for (const group of INTEREST_GROUPS) {
    for (const interest of group.interests) {
      if (interest.re.test(titleOnly) || interest.re.test(haystack)) found.push(interest.id);
    }
  }
  if (!found.length) found.push(CATEGORY_FALLBACK[event.category] ?? 'other');
  return [...new Set(found)];
}

// DeptNames values that are publishing buckets rather than real campus organizations. Showing
// "Ticketed Events" as the host of a film screening is worse than showing nothing, and it is the
// single most common value in the feed (128 of 351), so it would dominate any "follow an org" list.
const NOISE_ORGS = new Set([
  'Ticketed Events',
  'Featured Events - Main',
  'Other Events',
  'Suggested - Dance',
  'Suggested - Theatre and Film',
  'Main Calendar',
  'Student Financial Deadlines'
]);

// Athletics events carry no useful DeptNames, so the host is inferred from the category.
export function deriveOrgs(event, rawDepts) {
  const orgs = rawDepts.filter((d) => d && !NOISE_ORGS.has(d));
  if (orgs.length) return orgs;
  if (event.category === 'Athletics') return ['BYU Athletics'];
  return [];
}
