---
'test-inventory-mcp': patch
---

Refuse scan answers when test files, configs or dependencies resolve outside the project, including through symbolic
links. Start the server at the shared parent when both locations belong to the intended project. Scanning may read a
linked file before this answer check; the boundary is not a filesystem sandbox.
