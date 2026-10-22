# test-inventory-mcp

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
