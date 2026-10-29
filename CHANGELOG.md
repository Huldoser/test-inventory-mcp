# test-inventory-mcp

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
