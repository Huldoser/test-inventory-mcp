---
'test-inventory-mcp': minor
---

The server no longer needs globs: started with `--framework` alone, or called with `framework` and no `patterns`, it
scans the test files the project's configs run; before, `--framework` without globs was a usage error.
`find_tests` takes `projects`, to keep the tests one of the named projects runs, after each project's `grep`. `test_summary` returns `configs`, the config files the scanned files use with their
projects, and counts the tests of each project with `groupBy: "project"`. The instructions and tool descriptions name
what test-inventory 0.5.0 reads from the configs.
