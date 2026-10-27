---
'test-inventory-mcp': minor
---

Scans now use test-inventory 0.5.0, which reads the config each test file uses. Test records get `projects`, the
projects that run each test, and the run settings the config gives, with `timeoutSource`, `retriesSource` and
`repeatsSource` saying where each comes from and `timeoutConfigText`, `retriesConfigText` and `repeatsConfigText`
quoting a value the config sets under a condition, as `process.env.CI ? 2 : 0`. `find_tests` can pick these keys in
`fields`, and `scan_diagnostics` knows the new codes: `forbidden-only` for a `.only` the config's `forbidOnly` fails,
`undefined-tag` for a Vitest tag the config doesn't define, `file-not-run`, and `config-value-unknown`.
