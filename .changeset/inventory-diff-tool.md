---
'test-inventory-mcp': minor
---

Add diff_inventories to compare complete saved JSON scans inside the project. It pages changes with their original
records and matching evidence, counts change categories, and warns about incomparable hashes or incomplete scans.
Saved files must resolve inside the project and be regular files no larger than 128 MiB.

Require test-inventory 0.10.0 for the diff API and its config, dependency, focus and failure-scope fixes.
