// Packs the package, checks that it holds exactly the files it should, installs the tarball in an empty project and
// uses it the way an MCP client does, with scripts/ask-server.mjs.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { run } from './run.ts';

const root = path.resolve(import.meta.dirname, '..');
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string };
const work = mkdtempSync(path.join(tmpdir(), 'test-inventory-mcp-pack-'));

/** Each source file becomes a module; nothing else from the repository is published. */
function expectedFiles(): string[] {
  const modules = readdirSync(path.join(root, 'src'))
    .filter((file) => file.endsWith('.ts'))
    .map((file) => `dist/${file.replace(/\.ts$/, '.js')}`);
  // The first release writes CHANGELOG.md.
  const changelog = existsSync(path.join(root, 'CHANGELOG.md')) ? ['CHANGELOG.md'] : [];
  return [...modules, ...changelog, 'LICENSE', 'README.md', 'package.json'].sort();
}

try {
  const [{ filename, files }] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', work], root)) as {
    filename: string;
    files: { path: string }[];
  }[];
  assert.deepEqual(files.map((file) => file.path).sort(), expectedFiles());
  const app = path.join(work, 'app');
  mkdirSync(path.join(app, 'tests'), { recursive: true });
  writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'pack-smoke', private: true }));
  writeFileSync(
    path.join(app, 'tests', 'orders.spec.ts'),
    "import { test } from '@playwright/test';\ntest.skip('fills a limit order at the limit price', async () => {});\n",
  );
  run('npm', ['install', '--no-audit', '--no-fund', path.join(work, filename)], app);

  // Paths of the machine that built the package must not end up in it.
  const installed = path.join(app, 'node_modules', 'test-inventory-mcp');
  for (const file of files) {
    const text = readFileSync(path.join(installed, file.path), 'utf8');
    assert.doesNotMatch(text, /\/home\/[\w.-]+\/|\/Users\/[\w.-]+\/|[A-Z]:\\Users\\/i, file.path);
  }

  assert.equal(run(process.execPath, [path.join(installed, 'dist', 'bin.js'), '--version'], app).trim(), version);
  console.log(run(process.execPath, [path.join(root, 'scripts', 'ask-server.mjs'), app], root).trim());
} finally {
  rmSync(work, { recursive: true, force: true });
}
