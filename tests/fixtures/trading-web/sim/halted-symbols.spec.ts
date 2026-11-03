import { test, expect } from '../fixtures/index';
import { DESK_TAGS, HALTED_SYMBOLS } from '@trading/qa-shared';

// The tags and the symbols the exchange simulator keeps halted come from the QA package every desk's UI suite shares.
test.describe('halted symbols', () => {
  for (const symbol of HALTED_SYMBOLS) {
    test(`rejects an order for ${symbol} while it is halted`, async ({ orderTicket }) => {
      await orderTicket.open(symbol);
      await orderTicket.buy({ quantity: 10, limitPrice: 100 });
      await expect(orderTicket.error).toHaveText('Trading is halted');
    });
  }

  test('shows a halted order in the blotter', { tag: DESK_TAGS.risk }, async ({ blotter }) => {
    await expect(blotter.status('GME')).toHaveText('Halted');
  });
});
