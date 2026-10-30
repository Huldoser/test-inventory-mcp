---
'test-inventory-mcp': patch
---

Requires test-inventory 0.6.1, with its 21 fixes: test states from Vitest tags, `skipIf`/`runIf` and `retry` options,
barrel files and path aliases in `dependencies` and `related`, project names and `default: false` projects from the
configs, and files nested too deeply for the parser, which crashed the server. A server started with `npx` takes them
on its next start.
