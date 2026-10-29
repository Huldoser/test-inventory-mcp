import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { scan, type Framework, type Inventory } from 'test-inventory';

/** What the server was started with. Tools scan inside `root` only. */
export interface ServerConfig {
  /** The project, as a real path. */
  root: string;
  /** Used when a tool call gives none; null when the start command named none. */
  framework: Framework | null;
  /** Used when a tool call gives none; without them, the configs choose the test files. */
  patterns: string[];
}

/** The arguments every tool takes to say what to scan. */
export interface ScanArguments {
  directory?: string;
  framework?: Framework;
  patterns?: string[];
}

const MISSING =
  'This server was started without a test runner, so pass `framework`: "playwright" or "vitest". Without ' +
  '`patterns`, the test files are those the configs in `directory` and the folders below it run.';

/** A pattern from a tool call stays inside the folder it is scanned from: no absolute path and no `..`. */
function checkPattern(pattern: string): void {
  if (path.posix.isAbsolute(pattern) || path.win32.isAbsolute(pattern) || pattern.split(/[\\/]/).includes('..')) {
    throw new Error(
      `The pattern "${pattern}" reaches outside the folder it is scanned from. Patterns are relative to ` +
        '`directory` (the project root by default) and cannot start with "/" or a drive, or contain "..".',
    );
  }
}

/**
 * Changed files from the project root, as `git diff --name-only` writes them, named as the scan of `directory` names
 * them: from that folder. A file outside it is in no dependency of the tests there, so it is left out.
 */
export function relatedIn(directory: string | undefined, files: string[]): string[] {
  const folder = directory === undefined ? '.' : path.posix.normalize(directory.replaceAll('\\', '/'));
  return files.flatMap((file) => {
    if (path.posix.isAbsolute(file) || path.win32.isAbsolute(file) || file.split(/[\\/]/).includes('..')) {
      throw new Error(
        `The file "${file}" is outside the project. Changed files are relative to the project root, as ` +
          '`git diff --name-only` writes them, and cannot start with "/" or a drive, or contain "..".',
      );
    }
    const relative = path.posix.relative(folder, path.posix.normalize(file.replaceAll('\\', '/')));
    return relative.startsWith('../') ? [] : [relative];
  });
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
  if (framework === null) throw new Error(MISSING);
  args.patterns?.forEach(checkPattern);
  const root = args.directory === undefined ? config.root : await directoryIn(config.root, args.directory);
  const patterns = args.patterns ?? (config.patterns.length > 0 ? config.patterns : undefined);
  return scan({ root, patterns, framework });
}
