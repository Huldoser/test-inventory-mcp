import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { scan } from 'test-inventory';
import { format, resolveConfig } from 'prettier';
import { createServer } from '../src/server.ts';

interface Schema {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  items?: Schema;
  anyOf?: Schema[];
  $ref?: string;
  properties?: Record<string, Schema>;
  required?: string[];
}

interface Tool {
  name: string;
  description?: string;
  inputSchema: Schema;
  outputSchema?: Schema;
}

const target = new URL('../docs/tools.md', import.meta.url);
const fixture = new URL('../tests/fixtures/trading-web/', import.meta.url);

function cell(text: string): string {
  return text.replaceAll('|', '&#124;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', ' ');
}

function typeOf(schema: Schema): string {
  if (schema.$ref) return schema.$ref.split('/').at(-1) as string;
  if (schema.anyOf) return [...new Set(schema.anyOf.map(typeOf))].join(' or ');
  if (schema.type === 'array') return `${typeOf(schema.items as Schema)}[]`;
  return Array.isArray(schema.type) ? schema.type.join(' or ') : (schema.type ?? 'object');
}

function descriptionOf(schema: Schema): string {
  return schema.description ?? [...new Set((schema.anyOf ?? []).map(descriptionOf).filter(Boolean))].join(' ');
}

function constraints(schema: Schema): string {
  const values: string[] = [];
  if (schema.enum) values.push(`Values: ${schema.enum.map((value) => `\`${String(value)}\``).join(', ')}.`);
  if (schema.default !== undefined) values.push(`Default: \`${JSON.stringify(schema.default)}\`.`);
  for (const [key, label] of [
    ['minimum', 'Minimum'],
    ['maximum', 'Maximum'],
    ['minItems', 'Minimum items'],
    ['maxItems', 'Maximum items'],
    ['minLength', 'Minimum length'],
  ] as const) {
    if (schema[key] !== undefined) values.push(`${label}: ${schema[key]}.`);
  }
  if (schema.items) {
    const item = constraints(schema.items);
    if (item) values.push(`Each item: ${item}`);
  }
  return values.join(' ');
}

function table(schema: Schema, input: boolean): string {
  const lines = ['| Field | Type | Required | Description |', '| --- | --- | --- | --- |'];
  for (const [name, value] of Object.entries(schema.properties ?? {})) {
    const detail = [descriptionOf(value), input ? constraints(value) : ''].filter(Boolean).join(' ');
    lines.push(
      `| \`${name}\` | ${cell(typeOf(value))} | ${schema.required?.includes(name) ? 'Yes' : 'No'} | ${cell(detail)} |`,
    );
  }
  return lines.join('\n');
}

function json(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

/** Builds the reference from a real tools/list response and calls on a disposable trading fixture. */
export async function toolDocs(): Promise<string> {
  const root = mkdtempSync(path.join(tmpdir(), 'test-inventory-tool-docs-'));
  cpSync(fixture, root, { recursive: true });
  const server = createServer({ root, framework: 'playwright', patterns: ['tests/**/*.spec.ts'] });
  const client = new Client({ name: 'documentation', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    const inventory = await scan({ root, framework: 'playwright', patterns: ['tests/**/*.spec.ts'] });
    writeFileSync(path.join(root, 'before.json'), JSON.stringify(inventory));
    const login = path.join(root, 'tests/login.spec.ts');
    writeFileSync(
      login,
      readFileSync(login, 'utf8').replace(
        "test('signs in with email and password'",
        "test.skip('signs in with email and password'",
      ),
    );
    writeFileSync(
      path.join(root, 'after.json'),
      JSON.stringify(await scan({ root, framework: 'playwright', patterns: ['tests/**/*.spec.ts'] })),
    );
    const requests: Record<string, Record<string, unknown>> = {
      test_summary: { states: ['skip', 'fixme'], groupBy: 'file', limit: 2 },
      find_tests: { states: ['skip', 'fixme'], fields: ['fullName', 'state', 'condition', 'reason'], limit: 2 },
      get_tests: { ids: [inventory.tests.find((test) => test.isFixme)?.id] },
      scan_diagnostics: { levels: ['error'], limit: 2 },
      diff_inventories: { before: 'before.json', after: 'after.json', limit: 1 },
    };
    const lines = [
      '# MCP tool reference',
      '',
      "Generated from the server's tool schemas and real calls. Regenerate with `npm run docs:tools`; `npm run docs:check` checks drift.",
      '',
      'These examples scan a disposable copy of the made-up trading app. A login test is marked skip between the saved before and after scans. No project code is executed.',
      '',
      'The request examples show the tool name and arguments, without a JSON-RPC envelope. Responses show the complete structuredContent object; the server also returns the same JSON as text. Paths are relative to the configured project.',
      '',
      ...tools.map((tool) => `- [${tool.name}](#${tool.name})`),
      '',
      '## Shared behavior',
      '',
      '- The four scan tools reread files on each call. diff_inventories reads saved scans instead.',
      '- Input objects reject unknown keys. Keep the other arguments unchanged when passing nextCursor back as cursor.',
      '- A null nextCursor ends pagination. get_tests uses remaining ids instead of a cursor when a response is full.',
      '- directory and related paths are relative to the configured server root. patterns and diagnostic path are relative to directory; narrowing directory does not change the base of related.',
      '- For conditional counts, use test_summary with the same filters and read summary.conditionalCount. When counting records, request isConditional explicitly and retrieve every page.',
      '- No matches is a successful empty result. scanErrors counts errors that may leave tests out; call scan_diagnostics before trusting completeness.',
      '- A declared conditional state is not a run result. Expected failures execute. Related tests are candidates, not proof that other tests are safe to omit.',
      '',
    ];
    for (const tool of tools as Tool[]) {
      const args = requests[tool.name];
      const result = await client.callTool({ name: tool.name, arguments: args });
      if (result.isError) throw new Error(`Documentation call failed: ${tool.name}`);
      lines.push(
        `## ${tool.name}`,
        '',
        `Available since MCP ${tool.name === 'diff_inventories' ? '0.8.0' : '0.1.0'}. Arguments added later have their own compatibility requirements; see [versioning](../README.md#versioning).`,
        '',
        tool.description ?? '',
        '',
        '### Arguments',
        '',
        table(tool.inputSchema, true),
        '',
        '### Response fields',
        '',
        table(tool.outputSchema as Schema, false),
        '',
        'Nested test records use the [core output format](https://huldoser.github.io/test-inventory/reference/output).',
        '',
        '### Complete example',
        '',
        json({ name: tool.name, arguments: args }),
        '',
        'Response:',
        '',
        json(result.structuredContent),
        '',
      );
    }
    const noMatch = await client.callTool({
      name: 'find_tests',
      arguments: { grep: '^no trading test has this exact title$' },
    });
    const invalid = await client.callTool({ name: 'find_tests', arguments: { limit: 201 } });
    lines.push(
      '## No matches and recovery',
      '',
      'A valid query with no matches is not an error. For find_tests with an exact title pattern absent from the fixture:',
      '',
      json(noMatch.structuredContent),
      '',
      'An invalid argument is a tool error. For find_tests with limit 201, the response has isError: true and this corrective content:',
      '',
      json(invalid.content),
      '',
      'Use a limit from 1 to 200 and retry. A stale or changed cursor requires starting again without cursor. For scan errors, inspect scan_diagnostics and fix the named file, import or config; a zero error count still cannot prove static analysis discovered every runtime-generated test.',
      '',
      'See [troubleshooting](../README.md#troubleshooting) for project roots, missing ids, refused paths and saved inventory requirements.',
      '',
    );
    return await format(lines.join('\n'), { ...(await resolveConfig(fileURLToPath(target))), parser: 'markdown' });
  } finally {
    await client.close();
    await server.close();
    rmSync(root, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const markdown = await toolDocs();
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== markdown)
      throw new Error('Tool reference is stale. Run npm run docs:tools and review docs/tools.md.');
    console.log('Tool reference matches the server schemas and fixture responses.');
  } else {
    writeFileSync(target, markdown);
    console.log('Generated docs/tools.md.');
  }
}
