---
'test-inventory-mcp': patch
---

Require test-inventory 0.10.3 or a later 0.10 patch so MCP scans include the Node and Jest declaration fixes, avoid false Playwright load failures, and keep tests when a local require function is called without arguments. Registry publication now waits briefly when npm's exact-version read endpoint has not caught up, while other verification failures still stop publication.
