import { mkdtempSync, mkdirSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scanSource } from 'test-inventory';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_INVENTORY_BYTES, readInventory } from '../src/saved-inventory.ts';
import { call, callError, connect, type Connection } from './helpers.ts';

const work = mkdtempSync(path.join(tmpdir(), 'inventory-diff-'));
const root = path.join(work, 'desk');
let connection: Connection;
const code = `import { test, expect } from 'vitest';
test('quotes the bid', () => expect(187.25).toBeGreaterThan(0));
test('quotes the ask', () => expect(187.75).toBeGreaterThan(0));`;
const before = scanSource({ code, relativeFilePath: 'tests/quotes.test.ts', framework: 'vitest' });

beforeAll(async () => {
  mkdirSync(root);
  writeFileSync(path.join(root, 'base.json'), JSON.stringify(before));
  const after = scanSource({
    code: code.replaceAll('quotes the', 'prices the'),
    relativeFilePath: 'tests/quotes.test.ts',
    framework: 'vitest',
  });
  writeFileSync(path.join(root, 'head.json'), JSON.stringify(after));
  writeFileSync(path.join(root, 'invalid.json'), '{');
  writeFileSync(path.join(root, 'projected.json'), '{}');
  writeFileSync(path.join(work, 'outside.json'), JSON.stringify(before));
  symlinkSync(path.join(work, 'outside.json'), path.join(root, 'linked.json'), 'file');
  writeFileSync(path.join(root, 'large.json'), '');
  truncateSync(path.join(root, 'large.json'), MAX_INVENTORY_BYTES + 1);
  connection = await connect({ root, patterns: [], framework: 'vitest' });
});

afterAll(async () => {
  await connection.close();
  rmSync(work, { recursive: true, force: true });
});

describe('diff_inventories', () => {
  it('accepts a saved scan inside a project rooted at the filesystem root', async () => {
    const volume = path.parse(root).root;
    expect(await readInventory(volume, path.join(root, 'base.json'))).toEqual(before);
  });
  it('pages renamed tests and returns their original records with the match evidence', async () => {
    const args = { before: 'base.json', after: 'head.json', limit: 1 };
    const first = await call<{ total: number; nextCursor: string; changes: { match: string; before: unknown }[] }>(
      connection.client,
      'diff_inventories',
      args,
    );
    expect(first).toMatchObject({ total: 2, summary: { renamed: 2, changed: 2 }, changes: [{ match: 'bodyHash' }] });
    expect(first.changes[0].before).toEqual(before.tests[1]);
    const next = await call(connection.client, 'diff_inventories', { ...args, cursor: first.nextCursor });
    expect(next).toMatchObject({ total: 2, nextCursor: null, changes: [{ before: before.tests[0] }] });
  });

  it('returns an empty answer with a hint for unchanged inventories', async () => {
    const result = await call(connection.client, 'diff_inventories', { before: 'base.json', after: 'base.json' });
    expect(result).toMatchObject({
      total: 0,
      changes: [],
      nextCursor: null,
    });
    expect(result.hint).toContain('No test changes');
  });

  it.each([
    ['missing.json', 'does not exist'],
    ['invalid.json', 'is not JSON'],
    ['projected.json', 'complete schema v1'],
    ['../outside.json', 'outside the project'],
    ['linked.json', 'outside the project'],
    ['.', 'is not a file'],
    ['large.json', 'exceeds 128 MiB'],
  ])('refuses saved input %s with a corrective error', async (file, message) => {
    expect(await callError(connection.client, 'diff_inventories', { before: file, after: 'head.json' })).toContain(
      message,
    );
  });

  it('refuses a directory where a saved inventory is expected', async () => {
    expect(await callError(connection.client, 'diff_inventories', { before: 'base.json', after: '..' })).toContain(
      'outside the project',
    );
    mkdirSync(path.join(root, 'inventories'));
    expect(
      await callError(connection.client, 'diff_inventories', { before: 'inventories', after: 'head.json' }),
    ).toContain('is not a file');
  });

  it('cancels saved-file reads before touching the file system', async () => {
    const controller = new AbortController();
    const reason = new Error('The agent cancelled the saved quote comparison.');
    controller.abort(reason);
    await expect(readInventory(root, 'base.json', controller.signal)).rejects.toBe(reason);
  });
});
