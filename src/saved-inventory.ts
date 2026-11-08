import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Inventory } from 'test-inventory';
import { isInside } from './project.ts';

/** Bounds the memory of parsing a saved scan before its schema is checked by the core. */
export const MAX_INVENTORY_BYTES = 128 * 1024 * 1024;

/** Keeps operating-system paths out of errors and preserves cancellation during a saved-file operation. */
async function readable<T>(file: string, signal: AbortSignal | undefined, read: () => Promise<T>): Promise<T> {
  try {
    signal?.throwIfAborted();
    const result = await read();
    signal?.throwIfAborted();
    return result;
  } catch {
    signal?.throwIfAborted();
    throw new Error(`The inventory "${file}" could not be read. Check that it still exists and is readable.`);
  }
}

/** Reads a complete JSON scan inside the server's project; its contents remain untrusted project data. */
export async function readInventory(root: string, file: string, signal?: AbortSignal): Promise<Inventory> {
  signal?.throwIfAborted();
  let real: string;
  try {
    real = await realpath(path.resolve(root, file));
  } catch {
    signal?.throwIfAborted();
    throw new Error(`The inventory "${file}" does not exist. Pass a saved JSON scan inside the project.`);
  }
  signal?.throwIfAborted();
  if (!isInside(root, real)) {
    throw new Error(`The inventory "${file}" is outside the project. Pass a saved JSON scan inside it.`);
  }
  const info = await readable(file, signal, () => stat(real));
  if (!info.isFile()) throw new Error(`The inventory "${file}" is not a file. Pass a saved JSON scan.`);
  if (info.size > MAX_INVENTORY_BYTES)
    throw new Error(
      `The inventory "${file}" exceeds 128 MiB. Save a smaller scan with matching patterns or filters for both revisions.`,
    );
  const content = await readable(file, signal, () => readFile(real, { encoding: 'utf8', signal }));
  try {
    return JSON.parse(content) as Inventory;
  } catch {
    throw new Error(`The inventory "${file}" is not JSON. Save the full scan without --fields or --format jsonl.`);
  }
}
