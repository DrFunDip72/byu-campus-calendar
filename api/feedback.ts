/**
 * POST /api/feedback
 *
 * Records one anonymous survey response from the in-page feedback bar.
 *
 * WHY BLOB AND NOT A DATABASE
 * ---------------------------
 * Each response is written as its own small blob under `feedback/`. That choice is deliberate:
 *
 *   - Append-only by construction. There is no read-modify-write, so two students submitting at
 *     the same moment cannot overwrite each other. A single JSON file in storage would have that
 *     race; a row-per-insert database would not, but see below.
 *   - No connection pooling, no cold-start connection budget, nothing to keep warm.
 *   - Nothing to auto-pause. A free Postgres project that idles for a week can need a manual
 *     restore, which would silently drop responses weeks into a feedback window — exactly when
 *     nobody is watching. Blob has no such state.
 *
 * The cost is that aggregation means listing and reading N objects rather than one SQL query. At
 * the scale this is built for — tens to low hundreds of responses — that is a non-issue, and
 * /api/feedback-results caps its read anyway.
 *
 * PRIVACY
 * -------
 * The store is private, so no blob is reachable by URL. Nothing identifying is requested or kept:
 * no name, no email, no sign-in, no IP, no user agent. The UI says so next to the comment box.
 *
 * Responses:
 *   204  recorded
 *   400  malformed body
 *   405  wrong method
 *   503  storage unavailable (the client's analytics event still counted the response)
 */

import { put } from '@vercel/blob';

const VERDICTS = ['yes', 'no'] as const;
const LAYOUTS = ['list', 'cards', 'month'] as const;
const PLACEMENTS = ['web', 'app', 'standalone'] as const;
const ROLES = ['BYU student', 'BYU faculty or staff', 'Neither'] as const;

/** Generous enough for a real paragraph of feedback, bounded so a blob cannot be used as storage. */
const MAX_COMMENT = 1200;

const oneOf = <T extends readonly string[]>(list: T, value: unknown): T[number] | null =>
  typeof value === 'string' && (list as readonly string[]).includes(value)
    ? (value as T[number])
    : null;

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response('Malformed JSON', { status: 400 });
  }

  const verdict = oneOf(VERDICTS, body.verdict);
  const preferredLayout = oneOf(LAYOUTS, body.preferredLayout);
  const placement = oneOf(PLACEMENTS, body.placement);
  const layout = oneOf(LAYOUTS, body.layout);

  // The vote itself is the one required field. Everything else is optional, because a response
  // that arrives partially filled is still worth more than no response.
  if (!verdict) {
    return new Response('`verdict` must be "yes" or "no"', { status: 400 });
  }

  const rawComment = typeof body.comment === 'string' ? body.comment.trim() : '';

  const record = {
    at: new Date().toISOString(),
    verdict,
    preferredLayout,
    placement,
    layout,
    role: oneOf(ROLES, body.role),
    comment: rawComment ? rawComment.slice(0, MAX_COMMENT) : null
  };

  try {
    await put(`feedback/${record.at}-${crypto.randomUUID().slice(0, 8)}.json`, JSON.stringify(record), {
      access: 'private',
      contentType: 'application/json',
      // Pathnames already carry a timestamp and a random segment, so the extra suffix would only
      // make the objects harder to read when scanning the store by hand.
      addRandomSuffix: false
    });
  } catch (error) {
    console.error('feedback: blob write failed', error);
    return new Response('Storage unavailable', { status: 503 });
  }

  return new Response(null, { status: 204 });
}
