import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HELP, parseCommandLine } from '../src/command-line.ts';
import { fixtures } from './helpers.ts';

const tradingWeb = path.join(fixtures, 'trading-web');
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

const usage = (message: string) => ({
  exitCode: 2,
  text: `test-inventory-mcp: ${message}\nRun test-inventory-mcp --help for the options.\n`,
});

describe('parseCommandLine', () => {
  it('serves the globs and framework it is given, from the current folder', () => {
    expect(parseCommandLine(['tests/**/*.spec.ts', '--framework', 'playwright'], {}, tradingWeb)).toEqual({
      config: { root: tradingWeb, framework: 'playwright', patterns: ['tests/**/*.spec.ts'] },
    });
  });

  it('serves without test files, for tool calls to name them', () => {
    expect(parseCommandLine([], {}, tradingWeb)).toEqual({
      config: { root: tradingWeb, framework: null, patterns: [] },
    });
  });

  it('takes the project from --root, then CLAUDE_PROJECT_DIR, then the current folder', () => {
    const env = { CLAUDE_PROJECT_DIR: tradingWeb };
    expect(parseCommandLine(['--root', 'order-service'], env, fixtures)).toMatchObject({
      config: { root: path.join(fixtures, 'order-service') },
    });
    expect(parseCommandLine([], env, fixtures)).toMatchObject({ config: { root: tradingWeb } });
  });

  it('prints the help and the version', () => {
    expect(parseCommandLine(['--help'], {}, fixtures)).toEqual({ exitCode: 0, text: HELP });
    expect(parseCommandLine(['-v'], {}, fixtures)).toEqual({ exitCode: 0, text: `${version}\n` });
  });

  it('reports a wrong command line as a usage error', () => {
    // The message comes from Node.js's parseArgs, worded by the Node.js version.
    expect(parseCommandLine(['--frmework', 'vitest'], {}, fixtures)).toMatchObject({
      exitCode: 2,
      text: expect.stringMatching(/^test-inventory-mcp: .*'--frmework'/) as string,
    });
    expect(parseCommandLine(['src/**/*.test.ts', '--framework', 'jest'], {}, fixtures)).toEqual(
      usage('--framework must be playwright or vitest; got "jest".'),
    );
    const together = usage(
      'the globs and --framework go together: give both, or neither and let tool calls pass them.',
    );
    expect(parseCommandLine(['src/**/*.test.ts'], {}, fixtures)).toEqual(together);
    expect(parseCommandLine(['--framework', 'vitest'], {}, fixtures)).toEqual(together);
  });

  it('reports a project folder that is missing or is a file', () => {
    expect(parseCommandLine(['--root', 'risk-engine'], {}, fixtures)).toEqual(
      usage('the project folder "risk-engine" does not exist.'),
    );
    expect(parseCommandLine([], { CLAUDE_PROJECT_DIR: path.join(tradingWeb, 'package.json') }, fixtures)).toEqual(
      usage(`the project folder "${path.join(tradingWeb, 'package.json')}" is a file.`),
    );
  });
});
