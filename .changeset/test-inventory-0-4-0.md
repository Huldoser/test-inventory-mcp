---
'test-inventory-mcp': minor
---

Uses test-inventory 0.4.0. `get_tests` returns, and `fields` in `find_tests` picks, what it reads from each test's
body and the code around it: `hooks` that run around the test, its run settings (`timeout`, `isSlow`, `slowCondition`,
`retries`, `retryDelay`, `retryCondition`, `repeats`), the `fixtures` it takes, its assertions (`expectCount`,
`expectedAssertions`, `expectsAssertions`), `hasEmptyBody`, Playwright's `steps` and `isBenchmark`. The summary of
`test_summary` has a `benchmarkCount`, and `scan_diagnostics` filters by the new codes `empty-title` and
`bench-outside-benchmark-file`. The server instructions and the description of `get_tests` name the new data.
