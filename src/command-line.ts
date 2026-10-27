import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type { ServerConfig } from './project.ts';

/** The version of this package, read from its package.json in both the sources and the build. */
export const serverVersion: string = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
).version;

export const HELP = `Usage: test-inventory-mcp [--framework <playwright|vitest> [<glob...>]] [--root <dir>]

An MCP server on standard input and output. It answers an AI agent's questions about the
tests of a project from their source code, without running them.

  --framework <name>           playwright or vitest; a tool call can pass the other
  <glob...>                    test files to scan, relative to the root; without them, those the configs
                               run; a tool call can pass others
  --root <dir>                 the project; defaults to $CLAUDE_PROJECT_DIR, then the current folder
  -h, --help                   show this help
  -v, --version                show the version

Example, in an MCP client's configuration:
  npx -y test-inventory-mcp --framework playwright
`;

/** What the command line asks for: serving with a config, or printing a text and exiting. */
export type Command = { config: ServerConfig } | { exitCode: number; text: string };

function usageError(message: string): Command {
  return { exitCode: 2, text: `test-inventory-mcp: ${message}\nRun test-inventory-mcp --help for the options.\n` };
}

export function parseCommandLine(args: string[], env: NodeJS.ProcessEnv, cwd: string): Command {
  let values: { framework?: string; root?: string; help?: boolean; version?: boolean };
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        framework: { type: 'string' },
        root: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    }));
  } catch (error) {
    return usageError((error as Error).message);
  }
  if (values.help === true) return { exitCode: 0, text: HELP };
  if (values.version === true) return { exitCode: 0, text: `${serverVersion}\n` };
  const framework = values.framework ?? null;
  if (framework !== null && framework !== 'playwright' && framework !== 'vitest') {
    return usageError(`--framework must be playwright or vitest; got "${framework}".`);
  }
  if (framework === null && positionals.length > 0) {
    return usageError('the globs need --framework, the runner they are for.');
  }
  const given = values.root ?? env.CLAUDE_PROJECT_DIR ?? cwd;
  let root: string;
  try {
    // Native, like the realpath of project.ts: on Windows the JavaScript one keeps 8.3 short names such as RUNNER~1,
    // and a folder inside the project would then not start with its root.
    root = realpathSync.native(path.resolve(cwd, given));
  } catch {
    return usageError(`the project folder "${given}" does not exist.`);
  }
  if (!statSync(root).isDirectory()) return usageError(`the project folder "${given}" is a file.`);
  return { config: { root, framework, patterns: positionals } };
}
