import { createHash } from 'node:crypto';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;
/**
 * The most characters of JSON one answer takes. Claude Code warns above 10,000 tokens, about 30,000 characters of JSON,
 * so an answer stays below that and the next page is a call away.
 */
export const MAX_CHARACTERS = 30_000;

interface Position {
  offset: number;
  digest: string;
}

/** Ties a cursor to the exact list it pages through, so a list that changed in between is not paged wrong. */
function digestOf(items: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(items)).digest('hex').slice(0, 16);
}

function encode(position: Position): string {
  return Buffer.from(JSON.stringify(position)).toString('base64url');
}

function decode(cursor: string): Position {
  try {
    const position = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<Position>;
    if (Number.isSafeInteger(position.offset) && typeof position.digest === 'string') return position as Position;
  } catch {
    // Not JSON: reported below like any other cursor this server didn't write.
  }
  throw new Error('`cursor` is not a nextCursor this server returned. Call again without `cursor`.');
}

/**
 * Builds the answer for one page of `items`: at most `limit` of them, fewer when the answer would pass
 * `MAX_CHARACTERS`, and at least one. `answer` turns a page and the cursor of the next one into the tool's output.
 */
export function paginate<T, Output>(
  items: T[],
  limit: number,
  cursor: string | undefined,
  answer: (page: T[], nextCursor: string | null) => Output,
): Output {
  const digest = digestOf(items);
  let offset = 0;
  if (cursor !== undefined) {
    const position = decode(cursor);
    if (position.digest !== digest) {
      throw new Error(
        'The results changed since this cursor was returned: the files, or the other arguments, are not the same. ' +
          'Call again without `cursor`.',
      );
    }
    offset = position.offset;
  }
  const build = (count: number) => {
    const end = offset + count;
    return answer(items.slice(offset, end), end < items.length ? encode({ offset: end, digest }) : null);
  };
  const fits = (count: number) => JSON.stringify(build(count)).length <= MAX_CHARACTERS;
  // The largest page that fits; a single item is returned even when it alone is larger.
  let low = 1;
  let high = Math.max(1, Math.min(limit, items.length - offset));
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(middle)) low = middle;
    else high = middle - 1;
  }
  return build(low);
}
