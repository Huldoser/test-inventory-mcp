import { spawn } from 'node:child_process';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { describe, expect, it } from 'vitest';
import { fixtures } from './helpers.ts';

const bin = path.resolve(import.meta.dirname, '../dist/bin.js');
const tradingWeb = path.join(fixtures, 'trading-web');
const args = [bin, 'tests/**/*.spec.ts', '--framework', 'playwright'];
// Claude Code sets it for the servers it starts, and for this test run when it runs inside Claude Code.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'CLAUDE_PROJECT_DIR')) as Record<
  string,
  string
>;

// Each test starts Node.js; on a slow CI runner, as macos-15-intel, the first start alone takes 3 to 5 seconds.
describe('the built server over stdio', { timeout: 20_000 }, () => {
  it.each([
    ['2026-07-28', { versionNegotiation: { mode: { pin: '2026-07-28' as const } } }],
    ['2025-11-25', {}],
  ])('answers a client of the %s revision', async (_, options) => {
    const client = new Client({ name: 'tests', version: '1.0.0' }, options);
    await client.connect(new StdioClientTransport({ command: process.execPath, args, cwd: tradingWeb, env }));
    const result = await client.callTool({ name: 'test_summary', arguments: {} });
    expect(result.structuredContent).toMatchObject({ summary: { testCount: 31 } });
    await client.close();
  });

  it('writes nothing but JSON-RPC messages to standard output, and exits when standard input closes', async () => {
    const child = spawn(process.execPath, args, { cwd: tradingWeb, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    const exit = new Promise<number | null>((resolve) => child.on('exit', resolve));
    const send = (message: object) => child.stdin.write(`${JSON.stringify(message)}\n`);
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'tests', version: '1.0.0' } },
    });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'find_tests', arguments: { states: ['skip'] } },
    });
    await expect.poll(() => stdout.split('\n').filter(Boolean).length, { timeout: 10_000 }).toBe(2);
    child.stdin.end();
    expect(await exit).toBe(0);
    const messages = stdout
      .trimEnd()
      .split('\n')
      .map(
        (line) => JSON.parse(line) as { jsonrpc: string; id: number; result: { structuredContent: { total: number } } },
      );
    expect(messages.map((message) => [message.jsonrpc, message.id])).toEqual([
      ['2.0', 1],
      ['2.0', 2],
    ]);
    expect(messages[1].result.structuredContent.total).toBe(3);
  });
});
