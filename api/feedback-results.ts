/**
 * GET /api/feedback-results?key=…
 *
 * The private results page: a tally plus every written comment, rendered as a single self-contained
 * HTML page so it can be opened on a phone right after sharing the link, with no build step, no
 * dashboard and no client JavaScript.
 *
 * Guarded by a shared secret in `FEEDBACK_ADMIN_KEY`. That is proportionate rather than ideal:
 * responses are anonymous and contain no personal data by construction, so the thing being
 * protected is the aggregate, not anyone's identity. Comparison is constant-time anyway so the key
 * cannot be recovered a byte at a time, and the page is marked noindex and never cached.
 *
 * Responses:
 *   200  text/html
 *   401  missing or wrong key
 *   503  storage unavailable
 */

import { get, list } from '@vercel/blob';

/** Newest-first cap. Well above the expected volume, and bounds the per-request read cost. */
const MAX_RESPONSES = 300;

interface Record_ {
  at: string;
  verdict: 'yes' | 'no';
  preferredLayout: string | null;
  placement: string | null;
  layout: string | null;
  role: string | null;
  comment: string | null;
}

const escape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Constant-time compare, so a wrong key leaks nothing about how much of it was right. */
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function tally(records: Record_[], field: keyof Record_): [string, number][] {
  const counts = new Map<string, number>();
  for (const r of records) {
    const value = r[field];
    if (typeof value === 'string' && value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function bars(rows: [string, number][], total: number): string {
  if (rows.length === 0) return '<p class="none">No answers yet.</p>';
  return rows
    .map(([label, count]) => {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return `<div class="bar">
        <div class="bar-top"><span>${escape(label)}</span><span class="num">${count} · ${pct}%</span></div>
        <div class="track"><div class="fill" style="width:${pct}%"></div></div>
      </div>`;
    })
    .join('');
}

export async function GET(request: Request): Promise<Response> {
  const expected = process.env.FEEDBACK_ADMIN_KEY;
  const supplied = new URL(request.url).searchParams.get('key') ?? '';

  if (!expected || !secretsMatch(supplied, expected)) {
    return new Response('Unauthorized', { status: 401 });
  }

  let records: Record_[] = [];
  try {
    const { blobs } = await list({ prefix: 'feedback/', limit: 1000 });
    const newest = blobs
      .sort((a, b) => b.pathname.localeCompare(a.pathname))
      .slice(0, MAX_RESPONSES);

    const loaded = await Promise.all(
      newest.map(async (blob) => {
        try {
          const result = await get(blob.pathname, { access: 'private' });
          // `get` returns null when the object is gone, and a 304 variant with a null stream for a
          // conditional hit. Neither carries a body, so neither can be parsed.
          if (result?.statusCode !== 200) return null;
          return JSON.parse(await new Response(result.stream).text()) as Record_;
        } catch {
          // One unreadable or truncated object must not blank out the whole report.
          return null;
        }
      })
    );
    records = loaded.filter((r): r is Record_ => r !== null);
  } catch (error) {
    console.error('feedback-results: blob list failed', error);
    return new Response('Storage unavailable', { status: 503 });
  }

  const total = records.length;
  const yes = records.filter((r) => r.verdict === 'yes').length;
  const yesPct = total > 0 ? Math.round((yes / total) * 100) : 0;
  const comments = records.filter((r) => r.comment);

  const page = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Feedback — BYU Campus Calendar</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px 16px 64px; font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
         background:#f7f8fa; color:#13171f; -webkit-text-size-adjust:100%; }
  main { max-width:720px; margin:0 auto; }
  h1 { font-size:20px; margin:0 0 2px; }
  .sub { color:#5b6472; font-size:13px; margin:0 0 20px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; margin-bottom:24px; }
  .card { background:#fff; border:1px solid #e3e7ed; border-radius:10px; padding:12px 14px; }
  .card .big { font-size:26px; font-weight:650; letter-spacing:-.02em; }
  .card .cap { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:#5b6472; margin-top:2px; }
  section { background:#fff; border:1px solid #e3e7ed; border-radius:10px; padding:14px 16px; margin-bottom:16px; }
  h2 { font-size:12px; text-transform:uppercase; letter-spacing:.07em; color:#5b6472; margin:0 0 12px; }
  .bar { margin-bottom:10px; }
  .bar-top { display:flex; justify-content:space-between; font-size:13px; margin-bottom:3px; gap:12px; }
  .bar-top span:first-child { font-weight:550; }
  .num { color:#5b6472; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .track { height:7px; background:#eef1f5; border-radius:4px; overflow:hidden; }
  .fill { height:100%; background:#002E5D; border-radius:4px; }
  .none { color:#5b6472; font-size:13px; margin:0; }
  ul { list-style:none; margin:0; padding:0; }
  li { border-top:1px solid #eef1f5; padding:12px 0; }
  li:first-child { border-top:0; padding-top:0; }
  blockquote { margin:0 0 5px; font-size:14px; white-space:pre-wrap; overflow-wrap:anywhere; }
  .meta { font-size:11px; color:#5b6472; }
  .pill { display:inline-block; padding:1px 6px; border-radius:20px; font-size:10px; font-weight:650;
          text-transform:uppercase; letter-spacing:.04em; margin-right:5px; }
  .pill.yes { background:#dff3e6; color:#15603a; }
  .pill.no  { background:#fde8e8; color:#8a2020; }
  @media (prefers-color-scheme: dark) {
    body { background:#0f1217; color:#e8ebf0; }
    .card, section { background:#171b22; border-color:#262c36; }
    .track { background:#262c36; } .fill { background:#5c8ed6; }
    li { border-color:#222733; } .sub,.cap,.num,.meta,.none { color:#98a2b3; }
    .pill.yes { background:#15351f; color:#7fd6a0; } .pill.no { background:#3a1a1a; color:#f0a0a0; }
  }
</style>
</head><body><main>
  <h1>Feedback</h1>
  <p class="sub">BYU Campus Calendar · ${total} response${total === 1 ? '' : 's'}${
    total >= MAX_RESPONSES ? ` (showing the newest ${MAX_RESPONSES})` : ''
  } · generated ${escape(new Date().toISOString().replace('T', ' ').slice(0, 16))} UTC</p>

  <div class="cards">
    <div class="card"><div class="big">${total}</div><div class="cap">Responses</div></div>
    <div class="card"><div class="big">${yesPct}%</div><div class="cap">Would use it</div></div>
    <div class="card"><div class="big">${comments.length}</div><div class="cap">Wrote a comment</div></div>
  </div>

  <section><h2>Preferred layout</h2>${bars(tally(records, 'preferredLayout'), total)}</section>
  <section><h2>Who answered</h2>${bars(tally(records, 'role'), total)}</section>
  <section><h2>Surface they were on</h2>${bars(tally(records, 'placement'), total)}</section>

  <section><h2>Comments (${comments.length})</h2>
    ${
      comments.length === 0
        ? '<p class="none">No written comments yet.</p>'
        : `<ul>${comments
            .map(
              (r) => `<li>
                <blockquote>${escape(r.comment ?? '')}</blockquote>
                <div class="meta"><span class="pill ${r.verdict}">${r.verdict === 'yes' ? 'would use' : 'would not'}</span>${escape(
                  [r.role, r.preferredLayout ? `prefers ${r.preferredLayout}` : null, r.at.slice(0, 16).replace('T', ' ')]
                    .filter(Boolean)
                    .join(' · ')
                )}</div>
              </li>`
            )
            .join('')}</ul>`
    }
  </section>
</main></body></html>`;

  return new Response(page, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow'
    }
  });
}
