import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  changelogEntry,
  compareUrl,
  nextVersion,
  outdatedPins,
  pullRequestBody,
  releaseBranch,
  releaseTitle,
  repositorySlug,
} from '../scripts/release-plan.ts';

// What `changeset status --output` writes for one pending minor changeset.
const STATUS = {
  changesets: [
    {
      releases: [{ name: 'test-inventory-mcp', type: 'minor' }],
      summary: '`find_tests` takes `projects`.',
      id: 'quiet-orders-fill',
    },
  ],
  releases: [
    {
      name: 'test-inventory-mcp',
      type: 'minor',
      oldVersion: '0.2.0',
      changesets: ['quiet-orders-fill'],
      newVersion: '0.3.0',
    },
  ],
};

const CHANGELOG = `# test-inventory-mcp

## 0.3.0

### Minor Changes

- [#12](https://github.com/Huldoser/test-inventory-mcp/pull/12) [\`9cbd6d5\`](https://github.com/Huldoser/test-inventory-mcp/commit/9cbd6d5) - \`find_tests\` takes \`projects\`.

## 0.2.0

### Minor Changes

- [#9](https://github.com/Huldoser/test-inventory-mcp/pull/9) - Scans with test-inventory 0.4.0.
`;

const TEMPLATE = readFileSync(path.resolve(import.meta.dirname, '../.github/pull_request_template.md'), 'utf8');

const README = `Claude Code, in the project folder:

\`\`\`sh
claude mcp add --scope project test-inventory -- npx -y test-inventory-mcp@0.2 --framework playwright
\`\`\`

\`\`\`json
{ "args": ["-y", "test-inventory-mcp@0.2", "--framework", "playwright"] }
\`\`\`

Before 1.0, a change that breaks them raises the minor version, so \`test-inventory-mcp@0.2\` gets fixes only.
`;

describe('release plan', () => {
  it('reads the next version from the changeset status', () => {
    expect(nextVersion(STATUS, 'test-inventory-mcp')).toBe('0.3.0');
  });

  it('has no version when no changeset releases the package', () => {
    expect(nextVersion({ releases: [] }, 'test-inventory-mcp')).toBeNull();
    expect(nextVersion(STATUS, 'test-inventory')).toBeNull();
    expect(nextVersion({ releases: [{ name: 'test-inventory-mcp', type: 'none' }] }, 'test-inventory-mcp')).toBeNull();
  });

  it('names the branch and the pull request after the version', () => {
    expect(releaseBranch('0.3.0')).toBe('release-0.3.0');
    expect(releaseTitle('0.3.0')).toBe('Release 0.3.0');
  });

  it("takes a version's entry from the changelog, up to the next version", () => {
    expect(changelogEntry(CHANGELOG, '0.3.0')).toBe(
      '### Minor Changes\n\n- [#12](https://github.com/Huldoser/test-inventory-mcp/pull/12) [`9cbd6d5`](https://github.com/Huldoser/test-inventory-mcp/commit/9cbd6d5) - `find_tests` takes `projects`.',
    );
    expect(changelogEntry(CHANGELOG, '0.2.0')).toBe(
      '### Minor Changes\n\n- [#9](https://github.com/Huldoser/test-inventory-mcp/pull/9) - Scans with test-inventory 0.4.0.',
    );
    expect(changelogEntry(CHANGELOG.replaceAll('\n', '\r\n'), '0.2.0')).toContain('Scans with test-inventory 0.4.0.');
    expect(changelogEntry(CHANGELOG, '0.4.0')).toBe('');
  });

  it('fills the pull request template for a release', () => {
    const body = pullRequestBody(TEMPLATE, '0.3.0', changelogEntry(CHANGELOG, '0.3.0'));
    expect(body).toContain('## What changed\n\nRelease 0.3.0, made with `npm run release`.\n\n### Minor Changes\n');
    expect(body).not.toContain('<!--');
    expect(body).toContain('- [x] The README describes the change, or no README change is needed.');
    expect(body).toContain('- [x] A changeset describes the change for users');
    expect(body).toContain('- [ ] Tests cover the change');
  });

  it('keeps a $ in the changelog entry as it is', () => {
    const body = pullRequestBody(TEMPLATE, '0.3.0', 'Quotes `$&` in titles.');
    expect(body).toContain('Quotes `$&` in titles.');
  });

  it("lists the README's pins of an older minor version, which a new minor has to replace", () => {
    expect(outdatedPins(README, '0.3.0')).toEqual(['test-inventory-mcp@0.2']);
    expect(outdatedPins(README, '0.2.1')).toEqual([]);
    expect(outdatedPins(README.replaceAll('@0.2', '@0.3'), '0.3.0')).toEqual([]);
    expect(outdatedPins('No setup here.', '0.3.0')).toEqual([]);
  });

  it('reads the GitHub repository from package.json', () => {
    expect(repositorySlug('git+https://github.com/Huldoser/test-inventory-mcp.git')).toBe(
      'Huldoser/test-inventory-mcp',
    );
    expect(repositorySlug('git@github.com:Huldoser/test-inventory-mcp.git')).toBe('Huldoser/test-inventory-mcp');
    expect(repositorySlug('https://github.com/Huldoser/test-inventory-mcp')).toBe('Huldoser/test-inventory-mcp');
    expect(repositorySlug('https://gitlab.com/Huldoser/test-inventory-mcp.git')).toBeNull();
  });

  it('links to the pull request form with the title and description filled in', () => {
    const body = pullRequestBody(TEMPLATE, '0.3.0', '');
    const url = new URL(compareUrl('Huldoser/test-inventory-mcp', 'main', 'release-0.3.0', 'Release 0.3.0', body));
    expect(url.origin + url.pathname).toBe(
      'https://github.com/Huldoser/test-inventory-mcp/compare/main...release-0.3.0',
    );
    expect(url.searchParams.get('quick_pull')).toBe('1');
    expect(url.searchParams.get('title')).toBe('Release 0.3.0');
    expect(url.searchParams.get('body')).toBe(body);
  });
});
