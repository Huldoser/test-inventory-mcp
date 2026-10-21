import { describe, expect, it } from 'vitest';
import { MAX_CHARACTERS, paginate } from '../src/page.ts';

const orders = Array.from({ length: 40 }, (_, index) => ({
  orderId: `ORD-${String(index + 1).padStart(4, '0')}`,
  symbol: index % 2 === 0 ? 'AAPL' : 'MSFT',
  note: 'x'.repeat(2_000),
}));

const page = <T>(items: T[], limit: number, cursor?: string) =>
  paginate(items, limit, cursor, (items, nextCursor) => ({ items, nextCursor }));

describe('paginate', () => {
  it('returns an empty page for an empty list', () => {
    expect(page([], 50)).toEqual({ items: [], nextCursor: null });
  });

  it('returns fewer items than the limit when the answer would pass the size limit', () => {
    const first = page(orders, 40);
    expect(first.items.length).toBeLessThan(40);
    expect(JSON.stringify(first).length).toBeLessThanOrEqual(MAX_CHARACTERS);
    const oneMore = { items: orders.slice(0, first.items.length + 1), nextCursor: first.nextCursor };
    expect(JSON.stringify(oneMore).length).toBeGreaterThan(MAX_CHARACTERS);
  });

  it('returns one item alone when it is larger than the size limit', () => {
    const large = [
      { orderId: 'ORD-0001', note: 'x'.repeat(MAX_CHARACTERS) },
      { orderId: 'ORD-0002', note: '' },
    ];
    const first = page(large, 2);
    expect(first.items.map((item) => item.orderId)).toEqual(['ORD-0001']);
    expect(page(large, 2, first.nextCursor as string)).toEqual({ items: [large[1]], nextCursor: null });
  });

  it('refuses a cursor that is base64 of something other than a position', () => {
    const cursor = Buffer.from(JSON.stringify({ page: 2 })).toString('base64url');
    expect(() => page(orders, 10, cursor)).toThrow(
      '`cursor` is not a nextCursor this server returned. Call again without `cursor`.',
    );
  });
});
