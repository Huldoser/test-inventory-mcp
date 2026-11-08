// Usage: node scripts/ask-server.mjs <project>
//
// Starts the test-inventory-mcp installed in <project> as an MCP client does, asks it for the skipped tests of
// tests/*.spec.ts over stdio, and checks that standard output holds nothing but the two answers. Plain JavaScript, so
// that it also runs on Node.js versions that can't run TypeScript.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const app = path.resolve(process.argv[2]);
const bin = path.join(app, 'node_modules', 'test-inventory-mcp', 'dist', 'bin.js');
const require = createRequire(bin);
const { scanSource } = await import(pathToFileURL(require.resolve('test-inventory')).href);
const code =
  "import { test } from '@playwright/test'; test.skip('fills a limit order at the limit price', async () => {});";
for (const [file, source] of [
  ['before.json', code],
  ['after.json', code.replace('test.skip', 'test')],
]) {
  writeFileSync(
    path.join(app, file),
    JSON.stringify(scanSource({ code: source, framework: 'playwright', relativeFilePath: 'tests/orders.spec.ts' })),
  );
}
const child = spawn(process.execPath, [bin, 'tests/*.spec.ts', '--framework', 'playwright'], { cwd: app });
let stdout = '';
child.stdout.setEncoding('utf8').on('data', (chunk) => {
  stdout += chunk;
  // Closing standard input ends the server, so it waits for the scan and diff answers too.
  if (stdout.split('\n').filter(Boolean).length === 3) child.stdin.end();
});
child.stderr.pipe(process.stderr);
const exit = new Promise((resolve) => child.on('exit', resolve));
const messages = [
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'ask-server', version: '1.0.0' } },
  },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'find_tests', arguments: { states: ['skip'] } } },
  {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'diff_inventories', arguments: { before: 'before.json', after: 'after.json' } },
  },
];
for (const message of messages) child.stdin.write(`${JSON.stringify(message)}\n`);
assert.equal(await exit, 0);
const lines = stdout.trimEnd().split('\n');
assert.equal(lines.length, 3, stdout);
const responses = new Map(
  lines.map((line) => {
    const message = JSON.parse(line);
    return [message.id, message];
  }),
);
const initialized = responses.get(1);
const found = responses.get(2);
const compared = responses.get(3);
assert.equal(initialized.result.serverInfo.name, 'test-inventory-mcp');
const names = found.result.structuredContent.tests.map((test) => test.fullName);
assert.deepEqual(names, ['fills a limit order at the limit price']);
assert.equal(compared.result.structuredContent.summary.reEnabled, 1);
console.log(
  `test-inventory-mcp ${initialized.result.serverInfo.version} answered over stdio on Node.js ${process.version}.`,
);
