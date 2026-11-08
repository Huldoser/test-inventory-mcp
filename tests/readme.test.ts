// Checks that the README stays true to the server: its tools and their arguments, the command line, and the runners.
import { readFileSync } from 'node:fs';
import inventorySchema from 'test-inventory/schema/v1.json' with { type: 'json' };
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HELP } from '../src/command-line.ts';
import { connect, tradingWeb, type Connection } from './helpers.ts';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
/** The text of every code span outside code blocks. */
const spans = [...readme.replace(/^```[\s\S]*?^```/gm, '').matchAll(/`([^`]+)`/g)].map((match) => match[1]);

describe('README', () => {
  let connection: Connection;
  beforeAll(async () => {
    connection = await connect(tradingWeb);
  });
  afterAll(() => connection.close());

  it('names every tool and every argument the tools take', async () => {
    const { tools } = await connection.client.listTools();
    const names = tools.flatMap((tool) => [tool.name, ...Object.keys(tool.inputSchema.properties ?? {})]);
    expect([...new Set(names)].filter((name) => !spans.includes(name))).toEqual([]);
  });

  it('lists every command line option of the help', () => {
    const table = readme.slice(readme.indexOf('## Command line'), readme.indexOf('## Tools'));
    const documented = [...table.matchAll(/^\| (`[^|]+`) *\|/gm)].map((match) => match[1].replaceAll('`', ''));
    const help = [...HELP.matchAll(/^ {2}(\S.*?) {2,}/gm)].map((match) => match[1]);
    expect(documented).toEqual(help);
  });

  it('names every runner test-inventory reads, which `framework` takes', async () => {
    const runners = (inventorySchema.definitions.Framework.anyOf[0] as { enum: string[] }).enum;
    const { tools } = await connection.client.listTools();
    for (const tool of tools) {
      if (tool.name === 'diff_inventories') {
        expect(Object.keys(tool.inputSchema.properties ?? {})).toEqual(['before', 'after', 'limit', 'cursor']);
      } else {
        expect((tool.inputSchema.properties?.framework as { enum: string[] }).enum, tool.name).toEqual(runners);
      }
    }
    expect(runners.filter((runner) => !spans.includes(runner))).toEqual([]);
  });
});
