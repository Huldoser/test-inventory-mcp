import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import * as filesystem from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { readInventory } from '../src/saved-inventory.ts';

vi.mock('node:fs/promises', { spy: true });
const root = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'saved-inventory-errors-')));
mkdirSync(path.join(root, 'inventories'));
writeFileSync(path.join(root, 'inventories/base.json'), '{}');
afterEach(() => vi.restoreAllMocks());
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('saved inventory I/O failures', () => {
  it('reads normally with an active cancellation signal', async () => {
    await expect(readInventory(root, 'inventories/base.json', new AbortController().signal)).resolves.toEqual({});
  });

  it.each(['stat', 'readFile'] as const)('preserves cancellation when %s fails after aborting', async (operation) => {
    const controller = new AbortController();
    const reason = new Error('EXAMPLE cancelled file operation');
    vi.spyOn(filesystem, operation).mockImplementationOnce(() => {
      controller.abort(reason);
      return Promise.reject(new Error('EXAMPLE denied'));
    });
    await expect(readInventory(root, 'inventories/base.json', controller.signal)).rejects.toBe(reason);
  });

  it('stops after a successful stat if the request was cancelled during it', async () => {
    const original = await vi.importActual<typeof filesystem>('node:fs/promises');
    const controller = new AbortController();
    const reason = new Error('EXAMPLE cancelled during stat');
    vi.spyOn(filesystem, 'stat').mockImplementationOnce(async () => {
      const info = await original.stat(path.join(root, 'inventories/base.json'));
      controller.abort(reason);
      return info;
    });
    await expect(readInventory(root, 'inventories/base.json', controller.signal)).rejects.toBe(reason);
  });
  it.each(['stat', 'readFile'] as const)(
    'reports %s failures without exposing the resolved host path',
    async (operation) => {
      vi.spyOn(filesystem, operation).mockRejectedValueOnce(
        Object.assign(new Error(`EXAMPLE denied: ${path.join(root, 'inventories/base.json')}`), { code: 'EACCES' }),
      );
      let message = '';
      try {
        await readInventory(root, 'inventories/base.json');
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain('inventories/base.json');
      expect(message).toContain('readable');
      expect(message).not.toContain(root);
    },
  );

  it('preserves the cancellation reason when resolution fails during cancellation', async () => {
    const controller = new AbortController();
    const reason = new Error('EXAMPLE cancelled saved order scan');
    vi.spyOn(filesystem, 'realpath').mockImplementationOnce(() => {
      controller.abort(reason);
      return Promise.reject(new Error('EXAMPLE missing file'));
    });
    await expect(readInventory(root, 'inventories/base.json', controller.signal)).rejects.toBe(reason);
  });
});
