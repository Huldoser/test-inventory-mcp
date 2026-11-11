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
const output = vi.fn();

beforeEach(() => {
  request.mockReset();
  output.mockClear();
  vi.stubGlobal('fetch', request);
  vi.stubEnv('GITHUB_REF', 'refs/heads/main');
  vi.stubEnv('ACTIONS_ID_TOKEN_REQUEST_TOKEN', 'EXAMPLE_REQUEST_TOKEN');
  vi.stubEnv('ACTIONS_ID_TOKEN_REQUEST_URL', 'https://identity.example/token?request=EXAMPLE');
  vi.spyOn(console, 'log').mockImplementation(output);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function validMetadata(): void {
  request.mockResolvedValueOnce(Response.json(manifest)).mockResolvedValueOnce(Response.json({ valid: true }));
}

describe('MCP registry publication', () => {
  it.each([1, 11])('waits for npm propagation through %i not-found responses before validation', async (missing) => {
    vi.useFakeTimers();
    for (let i = 0; i < missing; i++) request.mockResolvedValueOnce(new Response(null, { status: 404 }));
    validMetadata();

    const publication = publishMcp();
    await vi.advanceTimersByTimeAsync(14_999);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1 + (missing - 1) * 15_000);
    await publication;

    expect(request).toHaveBeenCalledTimes(missing + 2);
    for (const [url, options] of request.mock.calls.slice(0, missing + 1)) {
      expect(url).toBe(`https://registry.npmjs.org/${manifest.name}/${manifest.version}`);
      expect(options).toMatchObject({ redirect: 'error' });
      expect(options?.headers).toBeUndefined();
    }
    expect(request.mock.calls[missing + 1]?.[0]).toBe('https://registry.modelcontextprotocol.io/v0/validate');
  });

  it('stops after twelve npm checks without validating or publishing unavailable metadata', async () => {
    vi.useFakeTimers();
    request.mockResolvedValue(new Response(null, { status: 404 }));
    const failure = expect(publishMcp(true)).rejects.toThrow(
      'npm package is still unavailable after 12 checks; retry the MCP Registry metadata workflow later.',
    );
    await vi.advanceTimersByTimeAsync(11 * 15_000);
    await failure;
    expect(request).toHaveBeenCalledTimes(12);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([400, 401, 403, 429, 500, 503])(
    'stops immediately on npm HTTP %i without logging the response',
    async (status) => {
      request.mockResolvedValueOnce(new Response('EXAMPLE_RESPONSE_CREDENTIAL', { status }));
      await expect(publishMcp(true)).rejects.toThrow(
        'npm verification failed; no response body or credentials were logged.',
      );
      expect(request).toHaveBeenCalledTimes(1);
      expect(output).not.toHaveBeenCalled();
    },
  );

  it('stops on npm authorization failure after a propagation retry', async () => {
    vi.useFakeTimers();
    request
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response('EXAMPLE_RESPONSE_CREDENTIAL', { status: 403 }));
    const failure = expect(publishMcp(true)).rejects.toThrow(
      'npm verification failed; no response body or credentials were logged.',
    );
    await vi.advanceTimersByTimeAsync(15_000);
    await failure;
    expect(request).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops on a failed npm request without logging its error or retrying', async () => {
    request.mockRejectedValueOnce(new Error('EXAMPLE_REQUEST_CREDENTIAL'));
    await expect(publishMcp(true)).rejects.toThrow(
      'npm verification failed; no response body or credentials were logged.',
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(output).not.toHaveBeenCalled();
  });

  it('stops on malformed npm JSON without logging its content or retrying', async () => {
    request.mockResolvedValueOnce(new Response('EXAMPLE_RESPONSE_CREDENTIAL'));
    await expect(publishMcp(true)).rejects.toThrow(
      'npm verification failed; no response body or credentials were logged.',
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(output).not.toHaveBeenCalled();
  });

  it.each([{ name: 'unrelated-package' }, { version: '0.0.0' }, { mcpName: 'com.example/unrelated' }])(
    'refuses mismatched npm identity after propagation: %j',
    async (mismatch) => {
      vi.useFakeTimers();
      request
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(Response.json({ ...manifest, ...mismatch }));
      const failure = expect(publishMcp(true)).rejects.toThrow('matching npm package');
      await vi.advanceTimersByTimeAsync(15_000);
      await failure;
      expect(request).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

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
