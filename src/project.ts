import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { scan, type Framework, type Inventory } from 'test-inventory';

/** What the server was started with. Tools scan inside `root` only. */
export interface ServerConfig {
  /** The project, as a real path. */
  root: string;
  /** Used when a tool call gives none; null when the start command named none, for the one the project uses. */
  framework: Framework | null;
  /** Used when a tool call gives none; without them, the configs choose the test files. */
  patterns: string[];
}

/** The arguments every tool takes to say what to scan. */
export interface ScanArguments {
  directory?: string;
  framework?: Framework;
  patterns?: string[];
  expandCases?: boolean;
}

/** Containment by path components, including a filesystem root and Windows drive roots. */
export function isInside(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/**
 * A pattern from a tool call stays inside the folder it is scanned from: no absolute path and no `..`. On Windows a
 * backslash separates folders, and elsewhere it escapes the next character, so `.\./` is `../` to the glob; a pattern
 * is refused when either reading leaves the folder, so the answer is the same on every system.
 */
function checkPattern(pattern: string): void {
  const unescaped = pattern.replaceAll(/\\(.)/gs, '$1');
  if (
    path.posix.isAbsolute(unescaped) ||
    path.win32.isAbsolute(pattern) ||
    [...pattern.split(/[\\/]/), ...unescaped.split('/')].includes('..')
  ) {
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
export async function relatedIn(root: string, directory: string | undefined, files: string[]): Promise<string[]> {
  const real = directory === undefined ? root : await directoryIn(root, directory);
  const folder = path.relative(root, real).split(path.sep).join('/');
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
  if (!isInside(root, real)) {
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
export async function scanProject(config: ServerConfig, args: ScanArguments, signal?: AbortSignal): Promise<Inventory> {
  const framework = args.framework ?? config.framework ?? undefined;
  args.patterns?.forEach(checkPattern);
  const root = args.directory === undefined ? config.root : await directoryIn(config.root, args.directory);
  const patterns = args.patterns ?? (config.patterns.length > 0 ? config.patterns : undefined);
  try {
    const inventory = await scan({ root, patterns, framework, expandCases: args.expandCases, signal });
    const files = new Set([
      ...inventory.files.map((file) => file.relativeFilePath),
      ...inventory.configs.map((file) => file.relativeFilePath),
      ...inventory.tests.flatMap((test) => test.dependencies),
    ]);
    for (const file of files) {
      signal?.throwIfAborted();
      const named = path.resolve(root, file);
      // Missing dependencies already have scan diagnostics; no code from them can be in the answer.
      const real = await realpath(named).catch(() => named);
      if (!isInside(config.root, real)) {
        throw new Error(
          'The scan reaches a file outside the project, through a link or an import. ' +
            'Pass patterns for files and dependencies inside the project, or start the server at their shared parent.',
        );
      }
    }
    return inventory;
  } catch (error) {
    // A request the client cancelled stops the scan, with the reason the client gave.
    if (signal?.aborted) throw error;
    // The scan throws only for its options. Without a runner named, it takes the one the project uses, and with none
    // or several it says what to pass, named as the tool argument.
    throw new Error((error as TypeError).message.replace('options.framework', '`framework`'));
  }
}
