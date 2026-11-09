// Registry metadata follows package.json at publication time; credentials stay in memory.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';

const registry = 'https://registry.modelcontextprotocol.io';

async function requestJson<T>(label: string, url: string | URL, options: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error();
    return (await response.json()) as T;
  } catch {
    // Authentication responses and request URLs can contain credentials.
    throw new Error(`${label} failed; no response body or credentials were logged.`);
  }
}

function jsonPost(body: unknown, token?: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  };
}

export async function publishMcp(publish = false): Promise<void> {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    name: string;
    version: string;
    mcpName: string;
  };
  const metadata = JSON.parse(readFileSync(new URL('../server.json', import.meta.url), 'utf8')) as {
    name: string;
    version: string;
    packages: { identifier: string; version: string }[];
  };
  if (metadata.name !== manifest.mcpName || metadata.packages[0].identifier !== manifest.name) {
    throw new Error('server.json must name the package and mcpName from package.json.');
  }
  metadata.version = manifest.version;
  metadata.packages[0].version = manifest.version;

  const published = await requestJson<typeof manifest>(
    'npm verification',
    `https://registry.npmjs.org/${manifest.name}/${manifest.version}`,
  );
  if (
    published.name !== manifest.name ||
    published.version !== manifest.version ||
    published.mcpName !== metadata.name
  ) {
    throw new Error('Publish the matching npm package and mcpName before publishing registry metadata.');
  }
  const validation = await requestJson<{ valid: boolean }>(
    'Registry validation',
    `${registry}/v0/validate`,
    jsonPost(metadata),
  );
  if (!validation.valid) throw new Error('Registry rejected server.json; validate its metadata before publishing.');
  if (!publish) {
    console.log(`Validated ${metadata.name}@${metadata.version} against the registry and published npm package.`);
    return;
  }

  if (process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Publish registry metadata only from main.');
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  if (!requestToken || !requestUrl) throw new Error('Run in GitHub Actions with id-token: write permission.');

  const serverUrl = `${registry}/v0.1/servers/${encodeURIComponent(metadata.name)}/versions/${metadata.version}`;
  const existing = await fetch(serverUrl, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (existing.ok) {
    const entry = (await existing.json()) as { server: unknown };
    if (!isDeepStrictEqual(entry.server, metadata))
      throw new Error('This registry version already exists with different metadata.');
    console.log(`Already published ${metadata.name}@${metadata.version}; metadata matches.`);
    return;
  }
  if (existing.status !== 404) throw new Error(`Registry lookup failed with HTTP ${existing.status}.`);

  const oidcUrl = new URL(requestUrl);
  oidcUrl.searchParams.set('audience', registry);
  const identity = await requestJson<{ value: string }>('GitHub OIDC authentication', oidcUrl, {
    headers: { Authorization: `Bearer ${requestToken}` },
  });
  if (typeof identity.value !== 'string' || !identity.value) throw new Error('GitHub returned no OIDC identity.');
  const authorization = await requestJson<{ registry_token: string }>(
    'Registry OIDC authentication',
    `${registry}/v0/auth/github-oidc`,
    jsonPost({ oidc_token: identity.value }),
  );
  if (typeof authorization.registry_token !== 'string' || !authorization.registry_token) {
    throw new Error('Registry returned no publication token.');
  }
  await requestJson('Registry publication', `${registry}/v0/publish`, jsonPost(metadata, authorization.registry_token));
  const verified = await requestJson<{ server: unknown }>('Registry read-back', serverUrl);
  if (!isDeepStrictEqual(verified.server, metadata))
    throw new Error('Published registry metadata did not match on read-back.');
  console.log(`Published and verified ${metadata.name}@${metadata.version}.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    await publishMcp(process.argv.includes('--publish'));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Registry publication failed.');
    process.exitCode = 1;
  }
}
