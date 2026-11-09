# Contributing

Thanks for helping. Bug reports with the tool call, the project it scanned and the answer you expected are the most
useful contribution. A test that is read wrong is a bug of
[test-inventory](https://github.com/Huldoser/test-inventory/issues); report it there.

## Setup

Node.js 22.18 or newer (the scripts in `scripts/` run as TypeScript), then:

```sh
npm ci
npm test
```

| Command                                | Does                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `npm test`                             | Builds `dist/`, then runs every test.                                       |
| `npm run coverage`                     | The tests with coverage. Every file in `src/` must stay at 100%.            |
| `npm run typecheck`                    | Type checks the sources, scripts and tests.                                 |
| `npm run lint`, `npm run format:check` | Checks ESLint rules and formatting without rewriting files.                 |
| `npm run format`                       | Rewrites files with Prettier; review the diff afterwards.                   |
| `npm run test:pack`                    | Packs the server, installs the tarball and checks communication over stdio. |
| `npm run licenses`                     | Checks the licenses of every installed package.                             |

## Tests

- Name tests by the behaviour they check.
- Examples belong to the made-up trading app of test-inventory's fixtures: orders, quotes, portfolios, strategies.
  Keep them believable.
- Every test runs on every system; none is skipped.

## Documentation

Keep the README's setup, verification steps, tool list and troubleshooting consistent with the server. Describe
declared states separately from observed execution, and distinguish the running server's local operation from
package installation and the client's model provider. The security policy and README must describe the same project
boundary, including what it does not enforce.

`tests/readme.test.ts` checks tool, argument, option and runner names. It does not establish that setup instructions,
example calls or security explanations are correct; verify those against the implementation and client docs too.

## Changesets

Every change that affects users carries a changeset. Run `npx changeset` and describe the change in a sentence.

Tool names, their inputs and their output are the server's API. Before 1.0:

- A breaking change is `minor`: renaming or removing a tool, an input or an output key, adding a required input, or
  narrowing the values an input takes. Never choose `major`: it would release 1.0.0.
- A new feature, such as a new tool, input or output key, is `minor`.
- A fix is `patch`.

## Releases

Releases are made from `main`. Changesets collect there until a maintainer releases them; nothing is published until a
release pull request is merged.

A new minor version needs the README's setup commands to pin it, as `test-inventory-mcp@0.3`, so that new installs
get it; raise them in a pull request before releasing. `npm run release` stops while they pin another minor.

Before releasing, read each pending changeset in `.changeset/` and check that the README describes it everywhere it
applies: search it, and the tool descriptions in `src/server.ts`, for the old behaviour, such as a list of runners, a
default or a rule, and update each place in a pull request first. `tests/readme.test.ts` checks that the README names
every tool, argument, command line option and runner, but it can't read prose.

1. On an up-to-date `main` with no local changes, run `npm run release`. It checks that `main` matches GitHub, that
   changesets are waiting and that the README pins their minor, makes a `release-x.y.z` branch, runs
   `changeset version`, updates the lockfile, commits "Release x.y.z", pushes the branch and opens the pull request,
   with gh when it is installed and otherwise through a link it prints. `changeset version` reads a GitHub token to
   link each change to its pull request: `GITHUB_TOKEN` when it is set, otherwise the one gh is logged in with.
   `npm run release -- --dry-run` shows the steps first.
2. Review the new `CHANGELOG.md` entry and the version in the pull request, and squash merge it when the checks pass.
3. The push to `main` starts the Release workflow. It builds, tests and packs the package, publishes it to npm with
   provenance, pushes the `vx.y.z` tag and creates the GitHub release. Merging is the approval: only `main` may use
   the `npm` environment.
4. npm lists the new version a few minutes after the run publishes it. Check with
   `npm view test-inventory-mcp@x.y.z --prefer-online`; don't re-run the publish job, as npm already has the version.

The same steps by hand, if the script can't be used:

1. Branch from an up-to-date `main`, for example `release-0.3.0`.
2. Run `GITHUB_TOKEN=$(gh auth token) npx changeset version`. It raises the version in `package.json`, writes
   `CHANGELOG.md` and deletes the changesets it used. The token is set for this one command and stored nowhere.
3. Run `npm install --package-lock-only` so that `package-lock.json` has the new version too.
4. Commit as "Release x.y.z", push, and open a pull request.

npm publishes with trusted publishing: the package's trusted publisher on npmjs.com names this repository,
`release.yml` and the `npm` environment, and allows `npm publish`. No npm token is involved. A maintainer with
two-factor authentication sets it up on the package's settings page on npmjs.com, or in a terminal:

```sh
npm trust github test-inventory-mcp --file release.yml --repo Huldoser/test-inventory-mcp --env npm --allow-publish
```

`mcpName` in `package.json` is the server's name in the MCP Registry, which checks it against the published package.
It starts with `io.github.Huldoser/`, spelled as GitHub spells the account, since the registry compares it exactly.

### MCP Registry

`server.json` describes the npm package for the official MCP Registry. The publication script takes the version from
`package.json`, so future releases use their exact npm version without changing the template. Registry installs ask
for `--root`, the absolute path to the local project; Node.js 22.12 or newer must be installed.

Run `node scripts/publish-mcp.ts` to validate the metadata and verify the matching published npm package. After npm
publishes, the Release workflow publishes matching registry metadata. For the first listing, or to retry metadata publication
after a registry failure, run Publish MCP Registry manually on `main` in GitHub Actions. It verifies an existing
entry before treating it as published. It never republishes the npm package.

The workflow exchanges GitHub Actions OIDC identity for a registry token through the registry's HTTP API. Tokens stay
in memory and are never saved or printed. No registry secret or additional publisher tool is needed. The registry
is in preview; its [publishing documentation](https://modelcontextprotocol.io/registry/github-actions) and
[publisher implementation](https://github.com/modelcontextprotocol/registry/tree/main/cmd/publisher) describe the flow.

### When a release goes wrong

- **The version is on npm, but there is no tag or GitHub release**, for example when the workflow failed after
  publishing. Running it again doesn't help: it sees that the version is published and does nothing. On the release
  commit, run `npx changeset git-tag`, push the tag with `git push origin vx.y.z`, and create the GitHub release for
  that tag with the `CHANGELOG.md` entry as its notes.
- **A release is broken.** Deprecate it first, so that new installs warn, with a message that says what is wrong and
  which version to use: `npm deprecate test-inventory-mcp@x.y.z "<message>"`. Then release the fix as a patch.
- **Unpublishing** is only for the first 72 hours after a publish, and a version number can never be used again, even
  after it is unpublished. Prefer deprecating.

## Dependencies

Dependencies stay on their newest versions; nothing updates them automatically, and `npm outdated` lists the ones
with a newer version. Update them in a pull request, after reading their changelogs. CI installs the versions in the
lockfile with `npm ci`, but npm never publishes the lockfile: users install the runtime dependencies from the ranges
in `package.json`.

The range of a dependency decides what `npm update` may install, and `tests/dependencies.test.ts` checks it:

- An exact version for a package whose version shows in files that CI compares: `prettier` formats every file. The
  `@vitest/` packages have the version of `vitest`, which is exact so that both always match. A prerelease is exact
  too, since `^` would also accept the next ones.
- `~` for a package whose minor releases can change results: `typescript` doesn't follow semantic versioning, and the
  minor releases of `eslint` and `typescript-eslint` can report more errors. `@types/node` has the version of the
  oldest supported Node.js in `engines`, so that newer APIs are not used by accident.
- `^` for every other package, so that users get the fixes of the runtime dependencies and share one copy with their
  other tools. On a 0.x version, `^` only accepts patch releases.

`typescript` stays on 6.0: typescript-eslint uses the TypeScript 6 API, which TypeScript 7 does not have.

## Pull requests

Keep a pull request to one change. Its title becomes the commit message when it is merged, so write it as a sentence
that says what the change does.
