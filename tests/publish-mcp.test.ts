import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishMcp } from '../scripts/publish-mcp.ts';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  name: string;
  version: string;
  mcpName: string;
};
const metadata = JSON.parse(readFileSync(new URL('../server.json', import.meta.url), 'utf8')) as {
  version: string;
  packages: { version: string }[];
};
metadata.version = manifest.version;
metadata.packages[0].version = manifest.version;
const request = vi.fn<typeof fetch>();

beforeEach(() => {
  request.mockReset();
  vi.stubGlobal('fetch', request);
  vi.stubEnv('GITHUB_REF', 'refs/heads/main');
  vi.stubEnv('ACTIONS_ID_TOKEN_REQUEST_TOKEN', 'EXAMPLE_REQUEST_TOKEN');
  vi.stubEnv('ACTIONS_ID_TOKEN_REQUEST_URL', 'https://identity.example/token?request=EXAMPLE');
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function validMetadata(): void {
  request.mockResolvedValueOnce(Response.json(manifest)).mockResolvedValueOnce(Response.json({ valid: true }));
}

describe('MCP registry publication', () => {
  it('validates without requesting credentials or publishing', async () => {
    validMetadata();
    await publishMcp();
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]?.[1]?.body).toBe(JSON.stringify(metadata));
  });

  it('refuses npm packages without the matching registry ownership name', async () => {
    request.mockResolvedValueOnce(Response.json({ ...manifest, mcpName: 'com.example/unrelated' }));
    await expect(publishMcp(true)).rejects.toThrow('matching npm package');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('stops before authentication when metadata validation fails', async () => {
    request.mockResolvedValueOnce(Response.json(manifest)).mockResolvedValueOnce(Response.json({ valid: false }));
    await expect(publishMcp(true)).rejects.toThrow('Registry rejected');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('refuses publication from a branch other than main', async () => {
    validMetadata();
    vi.stubEnv('GITHUB_REF', 'refs/heads/unreviewed');
    await expect(publishMcp(true)).rejects.toThrow('only from main');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('stops when GitHub has not granted an OIDC credential', async () => {
    validMetadata();
    vi.stubEnv('ACTIONS_ID_TOKEN_REQUEST_TOKEN', '');
    await expect(publishMcp(true)).rejects.toThrow('id-token: write');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('keeps a matching published version without authenticating or writing again', async () => {
    validMetadata();
    request.mockResolvedValueOnce(Response.json({ server: metadata }));
    await publishMcp(true);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('refuses to replace an existing version with different metadata', async () => {
    validMetadata();
    request.mockResolvedValueOnce(Response.json({ server: { ...metadata, title: 'Different server' } }));
    await expect(publishMcp(true)).rejects.toThrow('different metadata');
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('publishes with OIDC and verifies the stored metadata', async () => {
    validMetadata();
    request
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ value: 'EXAMPLE_IDENTITY' }))
      .mockResolvedValueOnce(Response.json({ registry_token: 'EXAMPLE_REGISTRY_TOKEN' }))
      .mockResolvedValueOnce(Response.json({ server: metadata }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ server: metadata }));
    await publishMcp(true);
    const identityUrl = request.mock.calls[3]?.[0] as URL;
    expect(identityUrl.searchParams.get('audience')).toBe('https://registry.modelcontextprotocol.io');
    expect(request.mock.calls[5]?.[1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer EXAMPLE_REGISTRY_TOKEN' },
      body: JSON.stringify(metadata),
      redirect: 'error',
    });
    expect(request).toHaveBeenCalledTimes(7);
  });

  it('stops on an authentication error without repeating a credential from its response', async () => {
    validMetadata();
    request
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response('EXAMPLE_REQUEST_TOKEN', { status: 403 }));
    await expect(publishMcp(true)).rejects.toThrow(
      'GitHub OIDC authentication failed; no response body or credentials were logged.',
    );
    expect(request).toHaveBeenCalledTimes(4);
  });
});
