import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { scan, type TestRecord } from 'test-inventory';
import { call, callError, connect, tradingWeb, type Connection } from './helpers.ts';

interface Page {
  tests: Partial<TestRecord>[];
  total: number;
  nextCursor: string | null;
  scanErrors: number;
  hint: string | null;
}

const requests = [
  ...readFileSync(new URL('../docs/tools.md', import.meta.url), 'utf8').matchAll(/^```json\n([\s\S]*?)\n```/gm),
].map((match) => JSON.parse(match[1]) as { name?: string; arguments?: Record<string, unknown> });
const request = requests.find((value) => value.name === 'find_tests') as {
  name: string;
  arguments: Record<string, unknown>;
};
let connection: Connection | undefined;
afterEach(async () => connection?.close());

it('runs the published matching query through every page without losing conditions or duplicating ids', async () => {
  connection = await connect(tradingWeb);
  const tests: Partial<TestRecord>[] = [];
  let page = await call<Page>(connection.client, request.name, request.arguments);
  const total = page.total;
  expect(page.nextCursor).not.toBeNull();
  for (;;) {
    expect(page.scanErrors).toBe(0);
    tests.push(...page.tests);
    if (page.nextCursor === null) break;
    page = await call<Page>(connection.client, request.name, { ...request.arguments, cursor: page.nextCursor });
  }
  expect(tests).toHaveLength(total);
  expect(new Set(tests.map((test) => test.id)).size).toBe(total);
  expect(tests.some((test) => test.condition?.includes('webkit'))).toBe(true);
  const inventory = await scan({ ...tradingWeb, framework: 'playwright' });
  const counts = await call<{ summary: { conditionalCount: number } }>(connection.client, 'test_summary', {
    states: ['skip', 'fixme'],
  });
  expect(counts.summary.conditionalCount).toBe(
    inventory.tests.filter((test) => ['skip', 'fixme'].includes(test.state) && test.isConditional).length,
  );
  expect(inventory.tests.some((test) => test.isExpectedToFail)).toBe(true);
  expect(tests.some((test) => test.state === 'expectedToFail')).toBe(false);
  const ids = new Set(tests.map((test) => test.id));
  expect([...ids].sort()).toEqual(
    inventory.tests
      .filter((test) => ['skip', 'fixme'].includes(test.state))
      .map((test) => test.id)
      .sort(),
  );
});

it('distinguishes a valid empty query from an argument error using the documented calls', async () => {
  connection = await connect(tradingWeb);
  const empty = await call<Page>(connection.client, 'find_tests', { grep: '^no trading test has this exact title$' });
  expect(empty.tests).toEqual([]);
  expect(empty.scanErrors).toBe(0);
  expect(empty.hint).toContain('No test matches');
  expect(await callError(connection.client, 'find_tests', { limit: 201 })).toContain('200');
});

it('reports scan gaps when an empty matching result comes from unreadable test imports', async () => {
  const root = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'test-inventory-mcp-docs-')));
  try {
    mkdirSync(path.join(root, 'tests'));
    writeFileSync(
      path.join(root, 'tests/orders.spec.ts'),
      "import { test } from './missing-fixtures'; test('routes a limit order', async () => {});\n",
    );
    connection = await connect({ ...tradingWeb, root });
    const empty = await call<Page>(connection.client, 'find_tests', request.arguments);
    expect(empty.tests).toEqual([]);
    expect(empty.scanErrors).toBeGreaterThan(0);
    expect(empty.hint).toContain('tests may be missing');
    const diagnostics = await call<{ diagnostics: { code: string }[] }>(connection.client, 'scan_diagnostics');
    expect(diagnostics.diagnostics.some((diagnostic) => diagnostic.code === 'unresolved-test-import')).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
