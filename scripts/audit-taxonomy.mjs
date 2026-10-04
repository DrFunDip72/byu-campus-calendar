// Measures how precise each interest rule is, so bad rules get caught instead of shipping.
//
// For every interest, it reports how many of its matched events contain the keyword in a
// *structural* field (title or category) versus only in free text (tags or description). A rule
// that matches almost nothing structurally is usually matching boilerplate, and is worth reading.
//
// This is not a pass/fail gate — some rules are legitimately description-driven. "Theatre" matches
// venue names like "BLACK BOX THEATRE (ARTS)" in the description, and those really are theatre
// productions. It is a review tool, and it earned its keep: it is how we found that all 20
// "Research" matches were Harold B. Lee Library boilerplate on Craft Night listings, and that a
// stray tag had put the Homecoming Dance in the golf feed.
//
// Usage: npm run audit

import { readFileSync } from 'node:fs';
import { INTEREST_GROUPS } from './taxonomy.mjs';

const data = JSON.parse(readFileSync(new URL('../src/data/events.json', import.meta.url), 'utf8'));

const LOW_PRECISION = 50;

console.log(`${data.events.length} events in the snapshot (generated ${data.generatedAt.slice(0, 10)})\n`);
console.log('interest              total   structural   free-text   structural %');
console.log('-'.repeat(72));

const flagged = [];

for (const group of INTEREST_GROUPS) {
  for (const interest of group.interests) {
    const matched = data.events.filter((e) => e.interests.includes(interest.id));
    if (!matched.length) {
      console.log(`${interest.id.padEnd(20)}${'0'.padStart(7)}${'—'.padStart(13)}${'—'.padStart(12)}${'—'.padStart(15)}`);
      continue;
    }
    const structural = matched.filter((e) => interest.re.test(`${e.title} ${e.category}`)).length;
    const freeText = matched.length - structural;
    const pct = Math.round((structural / matched.length) * 100);
    const flag = pct < LOW_PRECISION ? '  <-- review' : '';
    if (pct < LOW_PRECISION) flagged.push({ id: interest.id, pct, total: matched.length });
    console.log(
      `${interest.id.padEnd(20)}${String(matched.length).padStart(7)}${String(structural).padStart(13)}` +
        `${String(freeText).padStart(12)}${String(`${pct}%`).padStart(15)}${flag}`
    );
  }
}

console.log('-'.repeat(72));
if (flagged.length) {
  console.log(
    `\n${flagged.length} rule(s) match mostly on free text. Read their matches before assuming they are wrong:\n` +
      flagged.map((f) => `  ${f.id} (${f.pct}% structural, ${f.total} events)`).join('\n') +
      '\n\nTo inspect one: scripts/audit-taxonomy.mjs --show <interest-id>'
  );
} else {
  console.log('\nNo rules match predominantly on free text.');
}

// `--show <id>` prints the matches that came only from free text, with the matching excerpt, which
// is what makes a rule's failure mode obvious.
const showIndex = process.argv.indexOf('--show');
if (showIndex !== -1) {
  const id = process.argv[showIndex + 1];
  const interest = INTEREST_GROUPS.flatMap((g) => g.interests).find((i) => i.id === id);
  if (!interest) {
    console.error(`\nNo interest with id "${id}".`);
    process.exit(1);
  }
  const matched = data.events.filter(
    (e) => e.interests.includes(id) && !interest.re.test(`${e.title} ${e.category}`)
  );
  console.log(`\nFree-text-only matches for "${id}" (${matched.length}):`);
  for (const event of matched.slice(0, 25)) {
    const hit = `${event.tags.join(' ')} ${event.description}`.match(
      new RegExp(`.{0,45}(?:${interest.re.source}).{0,45}`, 'i')
    );
    console.log(`\n  ${event.title}  [${event.category}]`);
    console.log(`    ${hit ? hit[0].replace(/\s+/g, ' ').trim() : '(matched a tag)'}`);
  }
}
