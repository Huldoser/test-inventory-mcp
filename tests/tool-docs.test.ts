import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { toolDocs } from '../scripts/tool-docs.ts';

it('documents the current tool contracts and complete fixture answers without drift', async () => {
  expect(await toolDocs()).toBe(readFileSync(new URL('../docs/tools.md', import.meta.url), 'utf8'));
});
