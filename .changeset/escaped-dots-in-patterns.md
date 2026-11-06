---
'test-inventory-mcp': patch
---

A pattern that reaches outside the project through a backslash escape, as `.\./secret/*.test.ts`, is refused on every
system. On Linux and macOS the glob reads `\.` as `.`, so the check, which looked for `..` between slashes and
backslashes, let it through, and the answer listed tests from outside the project.
