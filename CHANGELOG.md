# test-inventory-mcp

## 0.7.1

### Patch Changes

- [#30](https://github.com/Huldoser/test-inventory-mcp/pull/30) [`1a503e3`](https://github.com/Huldoser/test-inventory-mcp/commit/1a503e307a613557e1e8f1f0dca775f9d7eb2050) - A pattern that reaches outside the project through a backslash escape, as `.\./secret/*.test.ts`, is refused on every
  system. On Linux and macOS the glob reads `\.` as `.`, so the check, which looked for `..` between slashes and
  backslashes, let it through, and the answer listed tests from outside the project.

- [#31](https://github.com/Huldoser/test-inventory-mcp/pull/31) [`de056b0`](https://github.com/Huldoser/test-inventory-mcp/commit/de056b0b6f205ac0f6ce5a9416c07bc730f050c4) - The server requires test-inventory 0.9.1, so its answers have that release's fixes: tests written as
  `(process.env.CI ? it.skip : it)(...)` are listed, `.mocharc.yml`, `bunfig.toml`, Cypress and WebdriverIO spec patterns,
  Jest's `moduleNameMapper` and Vite's `'@': '/src'` alias are read as the runners read them, Playwright 1.65's
  `test.skip('reason')` gives the reason, and node:test and Bun skip states follow their describes. A `bunfig.toml` in a
  scanned project can no longer change what later calls of a running server read.

## 0.7.0

### Minor Changes

- [#27](https://github.com/Huldoser/test-inventory-mcp/pull/27) [`ad1c66d`](https://github.com/Huldoser/test-inventory-mcp/commit/ad1c66d529e43640af7befc0573bd20869c54473) - Reads Mocha, Jasmine, Cypress, WebdriverIO, node:test and Bun projects too, with test-inventory 0.9.0: `--framework`
  and every tool's `framework` take `mocha`, `jasmine`, `cypress`, `webdriverio`, `node` and `bun`. A tool call the client
  cancels stops its scan between files.

## 0.6.0

### Minor Changes

- [#22](https://github.com/Huldoser/test-inventory-mcp/pull/22) [`fad31c9`](https://github.com/Huldoser/test-inventory-mcp/commit/fad31c91e3bc3150cdb4e440795abf0940a7cee8) - Requires test-inventory 0.8.0 and reads Jest 29 and 30 projects: `framework` and `--framework` take `jest`. Without a
  framework from the start command or the call, a call scans with the runner the project in `directory` uses; in a
  project with several, the error names them and asks for `framework`. Globs on the command line no longer need
  `--framework`.

## 0.5.0

### Minor Changes

- [#19](https://github.com/Huldoser/test-inventory-mcp/pull/19) [`a641650`](https://github.com/Huldoser/test-inventory-mcp/commit/a64165056c2eabe41460dcb6683a6818ffa50c69) - Requires test-inventory 0.7.0, so a server npx starts installs again and works out values imported from project files
  and counts loops over known values. Every tool takes a new `expandCases` argument, which lists each case of a `.each`
  or `.for` table and each pass of a loop as its own test, with the name the runner gives it and `caseIndex`; `get_tests`
  takes it too, as the ids of expanded tests differ. Answers have test-inventory 0.7.0's new `caseIndex` key and
  `cases-not-expanded` diagnostic.

## 0.4.1

### Patch Changes

- [#17](https://github.com/Huldoser/test-inventory-mcp/pull/17) [`f5a02f9`](https://github.com/Huldoser/test-inventory-mcp/commit/f5a02f925d9e923391cff3b002d0b3a3e8976c9b) - Requires test-inventory 0.6.1, with its 21 fixes: test states from Vitest tags, `skipIf`/`runIf` and `retry` options,
  barrel files and path aliases in `dependencies` and `related`, project names and `default: false` projects from the
  configs, and files nested too deeply for the parser, which crashed the server. A server started with `npx` takes them
  on its next start.

## 0.4.0

### Minor Changes

- [#15](https://github.com/Huldoser/test-inventory-mcp/pull/15) [`f72f735`](https://github.com/Huldoser/test-inventory-mcp/commit/f72f735352a50903e294575cd6fd66d6d7442a8c) - Scans now use test-inventory 0.6.0, which gives every test a `dependencyHash` of everything it runs in the project,
  the `dependencies` that went into it, and `hasUnfollowedDependencies`. `find_tests` and `test_summary` take `related`,
  the files a change touches, from the project root as `git diff --name-only` writes them, and keep the tests a change to
  one of them can affect. `find_tests` can pick the new keys in `fields`, and `scan_diagnostics` knows the new
  `dependency-not-followed` code. Since `dependencies` can list hundreds of files, `get_tests` returns as many tests as
  fit in one answer and the other ids in the new `remaining` key. The instructions and tool descriptions name the new
  question, which tests a change can affect.

## 0.3.0

### Minor Changes

- [#12](https://github.com/Huldoser/test-inventory-mcp/pull/12) [`9cbd6d5`](https://github.com/Huldoser/test-inventory-mcp/commit/9cbd6d59bee4700fd2cafed922eafd012ea5093e) - The server no longer needs globs: started with `--framework` alone, or called with `framework` and no `patterns`, it
  scans the test files the project's configs run; before, `--framework` without globs was a usage error.
  `find_tests` takes `projects`, to keep the tests one of the named projects runs, after each project's `grep`. `test_summary` returns `configs`, the config files the scanned files use with their
  projects, and counts the tests of each project with `groupBy: "project"`. The instructions and tool descriptions name
  what test-inventory 0.5.0 reads from the configs.

- [#12](https://github.com/Huldoser/test-inventory-mcp/pull/12) [`9cbd6d5`](https://github.com/Huldoser/test-inventory-mcp/commit/9cbd6d59bee4700fd2cafed922eafd012ea5093e) - Scans now use test-inventory 0.5.0, which reads the config each test file uses. Test records get `projects`, the
  projects that run each test, and the run settings the config gives, with `timeoutSource`, `retriesSource` and
  `repeatsSource` saying where each comes from and `timeoutConfigText`, `retriesConfigText` and `repeatsConfigText`
  quoting a value the config sets under a condition, as `process.env.CI ? 2 : 0`. `find_tests` can pick these keys in
  `fields`, and `scan_diagnostics` knows the new codes: `forbidden-only` for a `.only` the config's `forbidOnly` fails,
  `undefined-tag` for a Vitest tag the config doesn't define, `file-not-run`, and `config-value-unknown`.

## 0.2.0

### Minor Changes

- [#9](https://github.com/Huldoser/test-inventory-mcp/pull/9) [`83dbe23`](https://github.com/Huldoser/test-inventory-mcp/commit/83dbe2338e221d2b1f8506264f85b50088618815) - Uses test-inventory 0.4.0. `get_tests` returns, and `fields` in `find_tests` picks, what it reads from each test's
  body and the code around it: `hooks` that run around the test, its run settings (`timeout`, `isSlow`, `slowCondition`,
  `retries`, `retryDelay`, `retryCondition`, `repeats`), the `fixtures` it takes, its assertions (`expectCount`,
  `expectedAssertions`, `expectsAssertions`), `hasEmptyBody`, Playwright's `steps` and `isBenchmark`. The summary of
  `test_summary` has a `benchmarkCount`, and `scan_diagnostics` filters by the new codes `empty-title` and
  `bench-outside-benchmark-file`. The server instructions and the description of `get_tests` name the new data.

## 0.1.0

### Minor Changes

- [#2](https://github.com/Huldoser/test-inventory-mcp/pull/2) [`ad3027a`](https://github.com/Huldoser/test-inventory-mcp/commit/ad3027ac922fa63a135e70c4035bc817625b08bf) - An MCP server for test-inventory, with four read-only tools: `test_summary` counts tests by state, tag or file,
  `find_tests` lists the tests that match filters, `get_tests` returns every key of tests by id, and `scan_diagnostics`
  lists the problems the scan found. It serves both the 2026-07-28 revision of MCP and 2025 clients over stdio.
