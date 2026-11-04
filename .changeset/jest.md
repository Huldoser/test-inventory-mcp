---
'test-inventory-mcp': minor
---

Requires test-inventory 0.8.0 and reads Jest 29 and 30 projects: `framework` and `--framework` take `jest`. Without a
framework from the start command or the call, a call scans with the runner the project in `directory` uses; in a
project with several, the error names them and asks for `framework`. Globs on the command line no longer need
`--framework`.
