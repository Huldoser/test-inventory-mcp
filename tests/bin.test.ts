import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { serverVersion } from '../src/command-line.ts';
import { fixtures } from './helpers.ts';

vi.mock('@modelcontextprotocol/server/stdio', () => ({ serveStdio: vi.fn() }));

describe('bin', () => {
  const argv = process.argv;

  afterEach(() => {
    process.argv = argv;
    process.exitCode = undefined;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('serves over stdio with a new server for each connection', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(fixtures);
    process.argv = [process.execPath, 'test-inventory-mcp', '--root', 'trading-web'];
    await import('../src/bin.ts');
    const factory = vi.mocked(serveStdio).mock.calls[0][0] as () => McpServer;
    expect(factory()).toBeInstanceOf(McpServer);
    expect(factory()).not.toBe(factory());
    expect(process.exitCode).toBeUndefined();
  });

  it('prints the version to standard output', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.argv = [process.execPath, 'test-inventory-mcp', '--version'];
    await import('../src/bin.ts');
    expect(write).toHaveBeenCalledWith(`${serverVersion}\n`);
    expect(process.exitCode).toBe(0);
  });

  it('prints a usage error to standard error and exits with 2', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    process.argv = [process.execPath, 'test-inventory-mcp', '--framework', 'jest'];
    await import('../src/bin.ts');
    expect(write).toHaveBeenCalledWith(expect.stringContaining('--framework must be playwright or vitest'));
    expect(process.exitCode).toBe(2);
  });
});
