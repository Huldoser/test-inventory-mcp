import path from 'node:path';
import { filterInventory, scan, type Diagnostic, type TestRecord } from 'test-inventory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INSTRUCTIONS } from '../src/server.ts';
import { call, callError, connect, tradingWeb, type Connection, type Era } from './helpers.ts';

interface FoundTests {
  total: number;
  tests: Partial<TestRecord>[];
  nextCursor: string | null;
  scanErrors: number;
  hint: string | null;
}

function sortKeys(_key: string, value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)));
}

const expected = await scan({ root: tradingWeb.root, patterns: tradingWeb.patterns, framework: 'playwright' });

describe.each(['2026-07-28', '2025-11-25'] as Era[])('a client of the %s revision', (era) => {
  let connection: Connection;
  beforeEach(async () => {
    connection = await connect(tradingWeb, era);
  });
  afterEach(() => connection.close());

  it('gets the four tools, read-only, as recorded in tests/golden/tools.json', async () => {
    const { tools } = await connection.client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(['test_summary', 'find_tests', 'get_tests', 'scan_diagnostics']);
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    }
    // Both revisions carry the same definitions; the SDK writes their keys in a different order.
    await expect(`${JSON.stringify(tools, sortKeys, 2)}\n`).toMatchFileSnapshot('golden/tools.json');
  });

  it("gets the server's name, version and instructions", () => {
    expect(connection.client.getServerVersion()).toMatchObject({ name: 'test-inventory-mcp', title: 'test-inventory' });
    expect(connection.client.getInstructions()).toBe(INSTRUCTIONS);
  });

  it('gets the skipped tests with their reasons, as structured content and as its JSON text', async () => {
    const result = await connection.client.callTool({ name: 'find_tests', arguments: { states: ['skip'] } });
    const answer = result.structuredContent as FoundTests;
    expect(answer.tests.map((test) => [test.fullName, test.reason, test.condition])).toEqual([
      [
        'price alerts > notifies when the price crosses above the alert',
        'Alerts only trigger while the market is open',
        'isMarketClosed()',
      ],
      [
        'price alerts > does not notify for a price that was never reached',
        'Alerts only trigger while the market is open',
        'isMarketClosed()',
      ],
      ['price alerts > deletes an alert', 'Alerts only trigger while the market is open', 'isMarketClosed()'],
    ]);
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(result.structuredContent) }]);
  });
});

describe('find_tests', () => {
  let connection: Connection;
  beforeEach(async () => {
    connection = await connect(tradingWeb);
  });
  afterEach(() => connection.close());

  it('returns the default keys of each test, with id first', async () => {
    const answer = await call<FoundTests>(connection.client, 'find_tests', { states: ['expectedToFail'] });
    expect(answer).toEqual({
      framework: 'playwright',
      frameworkVersion: '1.63.0',
      total: 1,
      tests: [
        {
          id: '228b371fb6239871',
          fullName: 'backtests > exports trades to CSV',
          relativeFilePath: 'tests/backtest.spec.ts',
          lineStart: 20,
          state: 'expectedToFail',
          reason: null,
          condition: null,
          tags: ['@backtest'],
        },
      ],
      nextCursor: null,
      scanErrors: 0,
      hint: null,
    });
  });

  it('picks the keys named in fields, and keeps id', async () => {
    const answer = await call<FoundTests>(connection.client, 'find_tests', {
      states: ['fixme'],
      fields: ['stateSource', 'annotations'],
    });
    expect(answer.tests.map((test) => Object.keys(test))).toEqual(
      Array.from({ length: 4 }, () => ['id', 'stateSource', 'annotations']),
    );
  });

  it('combines filters, as test-inventory does', async () => {
    const reasonless = await call<FoundTests>(connection.client, 'find_tests', { withoutReason: true });
    expect(reasonless.tests.map((test) => test.fullName)).toEqual([
      'backtests > exports trades to CSV',
      'login > asks for a one-time code on a new device',
    ]);
    const smoke = await call<FoundTests>(connection.client, 'find_tests', { tags: ['@smoke'], grep: 'ORDER' });
    expect(smoke.tests.map((test) => test.fullName)).toEqual(
      expected.tests
        .filter((test) => test.tags.includes('@smoke') && /order/i.test(test.fullName))
        .map((test) => test.fullName),
    );
    const only = await call<FoundTests>(connection.client, 'find_tests', { only: true });
    expect(only.total).toBe(0);
  });

  it('keeps the tests one of the projects runs, after their grep', async () => {
    const answer = await call<FoundTests>(connection.client, 'find_tests', { projects: ['mobile-smoke'], limit: 100 });
    const runs = expected.tests.filter((test) => test.projects?.includes('mobile-smoke'));
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.length).toBeLessThan(expected.tests.length);
    expect(answer.tests.map((test) => test.id)).toEqual(runs.map((test) => test.id));
    const desktop = await call<FoundTests>(connection.client, 'find_tests', { projects: ['chromium', 'mobile-smoke'] });
    // A title built at run time meets mobile-smoke's grep, so the scan can't tell which projects run that test.
    expect(expected.tests.filter((test) => test.projects === null).map((test) => test.hasDynamicTitle)).toEqual([true]);
    expect(desktop.total).toBe(expected.tests.length - 1);
  });

  it('keeps the tests a change to a file can affect, with paths from the project root', async () => {
    const related = ['pages/orders-blotter.ts'];
    const answer = await call<FoundTests>(connection.client, 'find_tests', { related, fields: ['fullName'] });
    expect(answer.tests.map((test) => test.fullName)).toEqual(
      filterInventory(expected, { related }).tests.map((test) => test.fullName),
    );
    expect(answer.total).toBeGreaterThan(0);
    const summary = await call<{ summary: { testCount: number } }>(connection.client, 'test_summary', { related });
    expect(summary.summary.testCount).toBe(answer.total);
  });

  it('refuses a changed file outside the project', async () => {
    expect(await callError(connection.client, 'find_tests', { related: ['../shared/fees.ts'] })).toBe(
      'The file "../shared/fees.ts" is outside the project. Changed files are relative to the project root, as ' +
        '`git diff --name-only` writes them, and cannot start with "/" or a drive, or contain "..".',
    );
  });

  it('says how big the scan was when no test matches', async () => {
    const answer = await call<FoundTests>(connection.client, 'find_tests', { grep: 'margin call' });
    expect(answer.hint).toBe('No test matches; the scan found 31 tests in 11 files.');
  });

  it('pages through every test in file and line order with nextCursor', async () => {
    const pages: FoundTests[] = [await call<FoundTests>(connection.client, 'find_tests', { limit: 12 })];
    while (pages[pages.length - 1].nextCursor !== null) {
      const cursor = pages[pages.length - 1].nextCursor;
      pages.push(await call<FoundTests>(connection.client, 'find_tests', { limit: 12, cursor }));
    }
    expect(pages.map((page) => page.tests.length)).toEqual([12, 12, 7]);
    expect(pages[0].hint).toBe('Showing 12 of 31. Pass nextCursor as `cursor` for more, or narrow the filters.');
    expect(pages[2].hint).toBeNull();
    expect(pages.flatMap((page) => page.tests.map((test) => test.id))).toEqual(expected.tests.map((test) => test.id));
  });

  it('refuses a cursor from other filters, and one it never returned', async () => {
    const first = await call<FoundTests>(connection.client, 'find_tests', { limit: 2 });
    expect(await callError(connection.client, 'find_tests', { states: ['active'], cursor: first.nextCursor })).toBe(
      'The results changed since this cursor was returned: the files, or the other arguments, are not the same. ' +
        'Call again without `cursor`.',
    );
    expect(await callError(connection.client, 'find_tests', { cursor: 'page-2' })).toBe(
      '`cursor` is not a nextCursor this server returned. Call again without `cursor`.',
    );
  });

  it("passes on test-inventory's message for a grep that is not a regular expression", async () => {
    expect(await callError(connection.client, 'find_tests', { grep: '(limit' })).toBe(
      'filter.grep must be a regular expression: Invalid regular expression: /(limit/i: Unterminated group.',
    );
  });

  it('rejects a state it does not know, listing the ones it does', async () => {
    const message = await callError(connection.client, 'find_tests', { states: ['skipped'] });
    expect(message).toContain('states');
    expect(message).toContain('"expectedToFail"');
  });
});

describe('test_summary', () => {
  let connection: Connection;
  beforeEach(async () => {
    connection = await connect(tradingWeb);
  });
  afterEach(() => connection.close());

  it("returns test-inventory's summary, without groups unless asked", async () => {
    const answer = await call(connection.client, 'test_summary');
    expect(answer).toEqual({
      framework: 'playwright',
      frameworkVersion: '1.63.0',
      summary: expected.summary,
      configs: expected.configs,
      groups: null,
      total: null,
      nextCursor: null,
      scanErrors: 0,
      hint: null,
    });
  });

  it('counts the tests each project runs, with the configs that name the projects', async () => {
    const answer = await call<{ configs: { projects: { name: string }[] }[]; groups: { key: string }[] }>(
      connection.client,
      'test_summary',
      { states: ['active'], groupBy: 'project' },
    );
    expect(answer.configs.flatMap((config) => config.projects.map((project) => project.name))).toEqual([
      'chromium',
      'webkit',
      'mobile-smoke',
    ]);
    const active = expected.tests.filter((test) => test.state === 'active');
    expect(answer.groups.map((group) => group)).toEqual(
      ['chromium', 'mobile-smoke', 'webkit'].map((key) => {
        const runs = active.filter((test) => test.projects?.includes(key));
        return expect.objectContaining({ key, testCount: runs.length, activeCount: runs.length }) as object;
      }),
    );
  });

  it('counts the matching tests of each file, sorted by path', async () => {
    const answer = await call<{ summary: { testCount: number; fileCount: number }; groups: object[] }>(
      connection.client,
      'test_summary',
      { states: ['skip', 'fixme'], groupBy: 'file' },
    );
    expect(answer.summary).toMatchObject({ testCount: 7, fileCount: 11 });
    expect(answer.groups).toEqual([
      {
        key: 'tests/alerts.spec.ts',
        testCount: 3,
        activeCount: 0,
        skipCount: 3,
        fixmeCount: 0,
        todoCount: 0,
        expectedToFailCount: 0,
        notLoadedCount: 0,
      },
      {
        key: 'tests/login.spec.ts',
        testCount: 1,
        activeCount: 0,
        skipCount: 0,
        fixmeCount: 1,
        todoCount: 0,
        expectedToFailCount: 0,
        notLoadedCount: 0,
      },
      {
        key: 'tests/orders/limit-orders.spec.ts',
        testCount: 1,
        activeCount: 0,
        skipCount: 0,
        fixmeCount: 1,
        todoCount: 0,
        expectedToFailCount: 0,
        notLoadedCount: 0,
      },
      {
        key: 'tests/price-stream.spec.ts',
        testCount: 2,
        activeCount: 0,
        skipCount: 0,
        fixmeCount: 2,
        todoCount: 0,
        expectedToFailCount: 0,
        notLoadedCount: 0,
      },
    ]);
  });

  it('counts the tests of each tag and pages the groups', async () => {
    const first = await call<{ groups: { key: string; testCount: number }[]; total: number; nextCursor: string }>(
      connection.client,
      'test_summary',
      { groupBy: 'tag', limit: 3 },
    );
    const rest = await call<{ groups: { key: string; testCount: number }[]; nextCursor: null }>(
      connection.client,
      'test_summary',
      { groupBy: 'tag', limit: 3, cursor: first.nextCursor },
    );
    expect([...first.groups, ...rest.groups].map((group) => [group.key, group.testCount])).toEqual(
      Object.entries(expected.summary.tagCounts),
    );
    expect(first.total).toBe(4);
    expect(rest.nextCursor).toBeNull();
  });
});

describe('get_tests', () => {
  let connection: Connection;
  beforeEach(async () => {
    connection = await connect(tradingWeb);
  });
  afterEach(() => connection.close());

  it('returns every key of the tests in the order asked, with their diagnostics', async () => {
    const quote = expected.tests.find((test) => test.id === '8be9925edcd4647c') as TestRecord;
    const login = expected.tests.find((test) => test.id === 'dbb8916ae393be67') as TestRecord;
    const answer = await call<{ tests: TestRecord[]; diagnostics: Diagnostic[]; notFound: string[]; hint: string }>(
      connection.client,
      'get_tests',
      { ids: ['8be9925edcd4647c', '0000000000000000', 'dbb8916ae393be67', '8be9925edcd4647c'] },
    );
    expect(answer.tests).toEqual([quote, login]);
    expect(answer.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['test-in-loop', 'dynamic-title']);
    expect(answer.notFound).toEqual(['0000000000000000']);
    expect(answer.hint).toBe('Ids in notFound are not in this scan; find_tests returns the current ones.');
  });

  it('says nothing more when every id is found', async () => {
    const answer = await call(connection.client, 'get_tests', { ids: ['dbb8916ae393be67'] });
    expect(answer).toMatchObject({ diagnostics: [], notFound: [], hint: null });
  });

  it('returns as many tests as fit, and the other ids in remaining, as dependencies can be long', async () => {
    const ids = expected.tests.slice(0, 20).map((test) => test.id);
    const answer = await call<{ tests: TestRecord[]; remaining: string[]; hint: string }>(
      connection.client,
      'get_tests',
      {
        ids,
      },
    );
    expect(JSON.stringify(answer).length).toBeLessThanOrEqual(30_000);
    expect(answer.remaining.length).toBeGreaterThan(0);
    expect([...answer.tests.map((test) => test.id), ...answer.remaining]).toEqual(ids);
    expect(answer.hint).toBe('Ids in remaining were left out to keep the answer short; pass them again.');
  });

  it('takes at most 20 ids', async () => {
    const ids = Array.from({ length: 21 }, (_, index) => index.toString(16).padStart(16, '0'));
    expect(await callError(connection.client, 'get_tests', { ids })).toContain('ids');
  });
});

describe('scan_diagnostics', () => {
  let connection: Connection;
  beforeEach(async () => {
    connection = await connect(tradingWeb);
  });
  afterEach(() => connection.close());

  const codes = async (args: Record<string, unknown>) =>
    (await call<{ diagnostics: Diagnostic[] }>(connection.client, 'scan_diagnostics', args)).diagnostics.map(
      (diagnostic) => `${diagnostic.relativeFilePath} ${diagnostic.code}`,
    );

  it('returns every problem of the scan by default', async () => {
    const answer = await call(connection.client, 'scan_diagnostics');
    expect(answer).toEqual({
      framework: 'playwright',
      frameworkVersion: '1.63.0',
      total: 3,
      diagnostics: expected.diagnostics,
      nextCursor: null,
      hint: null,
    });
  });

  it('keeps the problems of a level, a code, a file or a folder', async () => {
    expect(await codes({ levels: ['error'] })).toEqual([]);
    expect(await codes({ codes: ['dynamic-title', 'unresolved-tag'] })).toEqual([
      'tests/orders/limit-orders.spec.ts unresolved-tag',
      'tests/quotes.spec.ts dynamic-title',
    ]);
    expect(await codes({ path: 'tests/quotes.spec.ts' })).toEqual([
      'tests/quotes.spec.ts test-in-loop',
      'tests/quotes.spec.ts dynamic-title',
    ]);
    expect(await codes({ path: 'tests/orders' })).toEqual(['tests/orders/limit-orders.spec.ts unresolved-tag']);
    expect(await codes({ path: 'tests/orders/' })).toEqual(['tests/orders/limit-orders.spec.ts unresolved-tag']);
  });

  it('pages the problems', async () => {
    const first = await call<{ diagnostics: Diagnostic[]; nextCursor: string; hint: string }>(
      connection.client,
      'scan_diagnostics',
      { limit: 2 },
    );
    expect(first.diagnostics).toHaveLength(2);
    expect(first.hint).toBe('Showing 2 of 3. Pass nextCursor as `cursor` for more, or narrow the filters.');
  });
});

describe('a server started without test files', () => {
  let connection: Connection;
  beforeEach(async () => {
    connection = await connect({ root: path.dirname(tradingWeb.root), framework: null, patterns: [] });
  });
  afterEach(() => connection.close());

  it('asks for a framework', async () => {
    expect(await callError(connection.client, 'test_summary', { directory: 'order-service' })).toBe(
      'This server was started without a test runner, so pass `framework`: "playwright" or "vitest". Without ' +
        '`patterns`, the test files are those the configs in `directory` and the folders below it run.',
    );
  });

  it('scans the files the configs run when a call gives no patterns', async () => {
    const answer = await call<{ summary: { testCount: number; fileCount: number } }>(
      connection.client,
      'test_summary',
      { directory: 'order-service', framework: 'vitest' },
    );
    const fromConfigs = await scan({
      root: path.join(path.dirname(tradingWeb.root), 'order-service'),
      framework: 'vitest',
    });
    expect(fromConfigs.summary.testCount).toBeGreaterThan(0);
    expect(answer.summary).toMatchObject({
      testCount: fromConfigs.summary.testCount,
      fileCount: fromConfigs.summary.fileCount,
    });
  });

  it('scans the directory, framework and patterns a call gives', async () => {
    const answer = await call<{ framework: string; frameworkVersion: string; summary: { testCount: number } }>(
      connection.client,
      'test_summary',
      { directory: 'order-service', framework: 'vitest', patterns: ['tests/**/*.test.ts'] },
    );
    const orderService = await scan({
      root: path.join(path.dirname(tradingWeb.root), 'order-service'),
      patterns: ['tests/**/*.test.ts'],
      framework: 'vitest',
    });
    expect(answer).toMatchObject({
      framework: 'vitest',
      frameworkVersion: orderService.frameworkVersion,
      summary: { testCount: 14 },
    });
  });

  it('says when no file matched, in every tool', async () => {
    const args = { directory: 'order-service', framework: 'vitest', patterns: ['e2e/**/*.spec.ts'] };
    const hint =
      'No test file was found, so there is nothing to report: check `patterns` and `directory`; scan_diagnostics says why.';
    expect(await call(connection.client, 'test_summary', args)).toMatchObject({ hint });
    expect(await call(connection.client, 'find_tests', args)).toMatchObject({ total: 0, hint });
    expect(await call(connection.client, 'get_tests', { ...args, ids: ['dbb8916ae393be67'] })).toMatchObject({
      hint: `${hint} Ids in notFound are not in this scan; find_tests returns the current ones.`,
    });
    expect(await call(connection.client, 'scan_diagnostics', args)).toMatchObject({ hint });
  });
});
