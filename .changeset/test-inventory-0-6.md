---
'test-inventory-mcp': minor
---

Scans now use test-inventory 0.6.0, which gives every test a `dependencyHash` of everything it runs in the project,
the `dependencies` that went into it, and `hasUnfollowedDependencies`. `find_tests` and `test_summary` take `related`,
the files a change touches, from the project root as `git diff --name-only` writes them, and keep the tests a change to
one of them can affect. `find_tests` can pick the new keys in `fields`, and `scan_diagnostics` knows the new
`dependency-not-followed` code. Since `dependencies` can list hundreds of files, `get_tests` returns as many tests as
fit in one answer and the other ids in the new `remaining` key. The instructions and tool descriptions name the new
question, which tests a change can affect.
