import { describe, expect, it } from 'vitest';
import { callError, connect, tradingWeb } from './helpers.ts';

describe.each(['2026-07-28', '2025-11-25'] as const)('%s unknown tool arguments', (era) => {
  it.each([
    ['find_tests', {}],
    ['test_summary', {}],
    ['scan_diagnostics', {}],
    ['get_tests', { ids: ['EXAMPLE'] }],
    ['diff_inventories', { before: 'EXAMPLE-before.json', after: 'EXAMPLE-after.json' }],
  ] as const)('refuses unrecognized keys in %s before running it', async (name, args) => {
    const connection = await connect(tradingWeb, era);
    try {
      expect(await callError(connection.client, name, { ...args, EXAMPLEUnknown: true })).toContain('EXAMPLEUnknown');
    } finally {
      await connection.close();
    }
  });
});
