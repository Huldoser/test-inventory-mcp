import { realpathSync } from 'node:fs';
import path from 'node:path';
import { Client, InMemoryTransport, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import type { ServerConfig } from '../src/project.ts';
import { createServer } from '../src/server.ts';

export const fixtures = realpathSync(path.resolve(import.meta.dirname, 'fixtures'));

export const tradingWeb: ServerConfig = {
  root: path.join(fixtures, 'trading-web'),
  framework: 'playwright',
  patterns: ['tests/**/*.spec.ts'],
};

/** Started without test files, as from a client's global configuration. */
export const unconfigured: ServerConfig = { root: fixtures, framework: null, patterns: [] };

export type Era = '2026-07-28' | '2025-11-25';

export interface Connection {
  client: Client;
  close: () => Promise<void>;
}

/**
 * A client connected to a new server in-process: over the HTTP handler for the 2026-07-28 revision, which the
 * in-memory pair doesn't serve, and over the in-memory pair for the 2025 handshake.
 */
export async function connect(config: ServerConfig, era: Era = '2026-07-28'): Promise<Connection> {
  if (era === '2026-07-28') {
    const handler = createMcpHandler(() => createServer(config));
    const client = new Client({ name: 'tests', version: '1.0.0' }, { versionNegotiation: { mode: { pin: era } } });
    await client.connect(
      new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
        fetch: (url, init) => handler.fetch(new Request(url, init)),
      }),
    );
    return {
      client,
      close: async () => {
        await client.close();
        await handler.close();
      },
    };
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(config);
  const client = new Client({ name: 'tests', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

/** Calls a tool and returns its structured answer, failing on an error result. */
export async function call<T = Record<string, unknown>>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError === true) throw new Error(`${name} failed: ${JSON.stringify(result.content)}`);
  return result.structuredContent as T;
}

/** Calls a tool that should fail and returns the message the model reads. */
export async function callError(client: Client, name: string, args: Record<string, unknown> = {}): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError !== true) throw new Error(`${name} did not fail: ${JSON.stringify(result.structuredContent)}`);
  return (result.content as { text: string }[])[0].text;
}
