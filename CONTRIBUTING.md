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

| Command                          | Does                                                             |
| -------------------------------- | ---------------------------------------------------------------- |
| `npm test`                       | Runs every test.                                                 |
| `npm run coverage`               | The tests with coverage. Every file in `src/` must stay at 100%. |
| `npm run typecheck`              | Type checks the sources, scripts and tests.                      |
| `npm run lint`, `npm run format` | ESLint and Prettier.                                             |
| `npm run licenses`               | Checks the licenses of every installed package.                  |

## Tests

- Name tests by the behaviour they check.
- Examples belong to the made-up trading app of test-inventory's fixtures: orders, quotes, portfolios, strategies.
  Keep them believable.
- Every test runs on every system; none is skipped.

## Changesets

Every change that affects users carries a changeset. Run `npx changeset` and describe the change in a sentence.

Tool names, their inputs and their output are the server's API. Before 1.0:

- A breaking change is `minor`: renaming or removing a tool, an input or an output key, adding a required input, or
  narrowing the values an input takes. Never choose `major`: it would release 1.0.0.
- A new feature, such as a new tool, input or output key, is `minor`.
- A fix is `patch`.

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
