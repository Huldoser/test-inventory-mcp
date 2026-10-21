import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerConfig } from '../src/project.ts';
import { call, callError, connect, type Connection } from './helpers.ts';

// A desk project next to a folder outside it, so a link and a path can try to reach out.
const work = realpathSync(mkdtempSync(path.join(tmpdir(), 'test-inventory-mcp-')));
const root = path.join(work, 'desk');
const config: ServerConfig = { root, framework: 'playwright', patterns: ['tests/**/*.spec.ts'] };
let connection: Connection;

beforeAll(async () => {
  mkdirSync(path.join(root, 'tests'), { recursive: true });
  mkdirSync(path.join(work, 'outside'));
  writeFileSync(
    path.join(root, 'tests', 'stop-loss.spec.ts'),
    "import { test } from '@playwright/test';\n\ntest('triggers a stop-loss order at the stop price', async () => {});\n",
  );
  writeFileSync(
    path.join(root, 'tests', 'trailing-stop.spec.ts'),
    "import { test } from '@playwright/test';\ntest('moves the stop up with the price', async () => {\n",
  );
  writeFileSync(
    path.join(root, 'tests', 'take-profit.spec.ts'),
    "import { test } from '@playwright/test';\ntest('closes the position at the target', async () =>\n",
  );
  // A junction needs no extra rights on Windows; elsewhere the type is ignored.
  symlinkSync(path.join(work, 'outside'), path.join(root, 'shared'), 'junction');
  connection = await connect(config);
});

afterAll(async () => {
  await connection.close();
  rmSync(work, { recursive: true, force: true });
});

describe('what a tool call scans', () => {
  it('counts the files that fail to parse as scan errors, and says where to look', async () => {
    const answer = await call(connection.client, 'find_tests');
    expect(answer).toMatchObject({
      total: 1,
      scanErrors: 2,
      hint: '2 scan errors: tests may be missing from this answer; scan_diagnostics lists them.',
    });
    const only = await call(connection.client, 'test_summary', {
      patterns: ['tests/stop-loss.spec.ts', 'tests/take-profit.spec.ts'],
    });
    expect(only).toMatchObject({
      scanErrors: 1,
      hint: '1 scan error: tests may be missing from this answer; scan_diagnostics lists them.',
    });
  });

  it('scans a folder inside the project', async () => {
    const answer = await call(connection.client, 'test_summary', {
      directory: 'tests',
      patterns: ['stop-loss.spec.ts'],
    });
    expect(answer).toMatchObject({ summary: { fileCount: 1, testCount: 1 }, scanErrors: 0 });
  });

  it('refuses a folder outside the project, also through a link', async () => {
    const outside = 'is outside the project. Pass a folder inside it, relative to the project root.';
    expect(await callError(connection.client, 'find_tests', { directory: '..' })).toBe(`The directory ".." ${outside}`);
    expect(await callError(connection.client, 'find_tests', { directory: '../outside' })).toBe(
      `The directory "../outside" ${outside}`,
    );
    expect(await callError(connection.client, 'find_tests', { directory: 'shared' })).toBe(
      `The directory "shared" ${outside}`,
    );
  });

  it('refuses a folder that is missing or is a file', async () => {
    expect(await callError(connection.client, 'find_tests', { directory: 'e2e' })).toBe(
      'The directory "e2e" does not exist in the project.',
    );
    expect(await callError(connection.client, 'find_tests', { directory: 'tests/stop-loss.spec.ts' })).toBe(
      '"tests/stop-loss.spec.ts" is a file. Pass the folder to scan, and the files as `patterns`.',
    );
  });

  it('refuses patterns that reach outside the folder', async () => {
    const rest =
      'reaches outside the folder it is scanned from. Patterns are relative to `directory` (the project root by ' +
      'default) and cannot start with "/" or a drive, or contain "..".';
    for (const pattern of [
      '../outside/**/*.spec.ts',
      'tests/../../outside/*.ts',
      '/etc/**',
      'C:\\Users\\**',
      '..\\**',
    ]) {
      expect(await callError(connection.client, 'find_tests', { patterns: ['tests/**/*.spec.ts', pattern] })).toBe(
        `The pattern "${pattern}" ${rest}`,
      );
    }
  });

  it('uses the patterns of the start command for another framework a call names', async () => {
    const answer = await call(connection.client, 'test_summary', { framework: 'vitest' });
    expect(answer).toMatchObject({ framework: 'vitest', summary: { fileCount: 3 } });
  });
});
