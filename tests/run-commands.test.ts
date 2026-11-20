import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { RunCommand } from 'test-inventory';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { call, callError, connect, unconfigured, type Connection } from './helpers.ts';

interface Page {
  total: number;
  nextCursor: string | null;
  commands: RunCommand[];
}

let connection: Connection;
beforeEach(async () => {
  connection = await connect(unconfigured);
});
afterEach(() => connection.close());

const scan = { directory: 'trading-web', framework: 'playwright' };

it('maps a server-root change to files, projects and a command relative to the scan directory', async () => {
  expect(
    await call(connection.client, 'get_run_commands', {
      ...scan,
      related: ['trading-web/tests/login.spec.ts'],
    }),
  ).toEqual({
    framework: 'playwright',
    frameworkVersion: '1.63.0',
    total: 1,
    nextCursor: null,
    scanErrors: 0,
    hint: null,
    commands: [
      {
        config: 'playwright.config.ts',
        projects: ['chromium', 'mobile-smoke', 'webkit'],
        files: ['tests/login.spec.ts'],
        command:
          'npx playwright test tests/login.spec.ts --config playwright.config.ts --project chromium mobile-smoke webkit',
        caveat: null,
      },
    ],
  });
});

it('returns an empty page and a hint when no test depends on a changed path', async () => {
  expect(
    await call(connection.client, 'get_run_commands', { ...scan, related: ['docs/market-hours.md'] }),
  ).toMatchObject({ commands: [], total: 0, nextCursor: null, hint: 'No test command matches the changed files.' });
});

it('rejects changes outside the project and requires at least one changed path', async () => {
  expect(await callError(connection.client, 'get_run_commands', { ...scan, related: ['../elsewhere.ts'] })).toContain(
    'outside the project',
  );
  expect(await callError(connection.client, 'get_run_commands', { ...scan, related: [] })).toContain('related');
});

it('pages distinct runner configs when the same change affects both packages', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'test-inventory-trading-'));
  try {
    const packages = ['options', 'stocks'];
    const related = packages.map((name) => name + '/quotes.test.ts');
    for (const folder of packages) {
      mkdirSync(path.join(root, folder));
      writeFileSync(
        path.join(root, folder, 'vitest.config.ts'),
        'export default { test: { include: ["*.test.ts"] } };',
      );
      writeFileSync(
        path.join(root, folder, 'quotes.test.ts'),
        "import { test } from 'vitest'; test('refreshes the opening quote', () => {});",
      );
    }
    const session = await connect({ root, framework: 'vitest', patterns: ['**/*.test.ts'] });
    try {
      const args = { related, limit: 1 };
      const first = await call<Page>(session.client, 'get_run_commands', args);
      expect(first.total).toBe(2);
      expect(first.nextCursor).toEqual(expect.any(String));
      const last = await call<Page>(session.client, 'get_run_commands', { ...args, cursor: first.nextCursor });
      expect(last.nextCursor).toBeNull();
      expect([...first.commands, ...last.commands].map(({ config, files }) => ({ config, files }))).toEqual(
        packages.map((name) => ({ config: name + '/vitest.config.ts', files: [name + '/quotes.test.ts'] })),
      );
    } finally {
      await session.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
