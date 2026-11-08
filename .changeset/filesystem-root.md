---
'test-inventory-mcp': patch
---

Allow subdirectories and saved inventories when the configured project root is a filesystem root, including a
Windows drive root. The old prefix check incorrectly classified its children as outside the project.
