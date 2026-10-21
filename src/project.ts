import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { scan, type Framework, type Inventory } from 'test-inventory';

/** What the server was started with. Tools scan inside `root` only. */
export interface ServerConfig {
  /** The project, as a real path. */
  root: string;
  /** Used when a tool call gives none; null when the start command named none. */
  framework: Framework | null;
  patterns: string[];
}

/** The arguments every tool takes to say what to scan. */
export interface ScanArguments {
  directory?: string;
  framework?: Framework;
  patterns?: string[];
}

const MISSING =
  'This server was started without test files to scan, so pass `framework` ("playwright" or "vitest") and ' +
  '`patterns`, the globs of the test files from the project root, such as ["tests/**/*.spec.ts"]. The test ' +
  "runner's config file has them: testDir and testMatch in playwright.config, test.include in vitest.config.";

/** A pattern from a tool call stays inside the folder it is scanned from: no absolute path and no `..`. */
function checkPattern(pattern: string): void {
  if (path.posix.isAbsolute(pattern) || path.win32.isAbsolute(pattern) || pattern.split(/[\\/]/).includes('..')) {
    throw new Error(
      `The pattern "${pattern}" reaches outside the folder it is scanned from. Patterns are relative to ` +
        '`directory` (the project root by default) and cannot start with "/" or a drive, or contain "..".',
    );
  }
}

async function directoryIn(root: string, directory: string): Promise<string> {
  let real: string;
  try {
    real = await realpath(path.resolve(root, directory));
  } catch {
    throw new Error(`The directory "${directory}" does not exist in the project.`);
  }
  if (real !== root && !real.startsWith(root + path.sep)) {
    throw new Error(
      `The directory "${directory}" is outside the project. Pass a folder inside it, relative to the project root.`,
    );
  }
  if (!(await stat(real)).isDirectory()) {
    throw new Error(`"${directory}" is a file. Pass the folder to scan, and the files as \`patterns\`.`);
  }
  return real;
}

/** Scans what the arguments name, falling back to what the server was started with. */
export async function scanProject(config: ServerConfig, args: ScanArguments): Promise<Inventory> {
  const framework = args.framework ?? config.framework;
  const patterns = args.patterns ?? config.patterns;
  if (framework === null || patterns.length === 0) throw new Error(MISSING);
  args.patterns?.forEach(checkPattern);
  const root = args.directory === undefined ? config.root : await directoryIn(config.root, args.directory);
  return scan({ root, patterns, framework });
}
