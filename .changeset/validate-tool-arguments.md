---
'test-inventory-mcp': minor
---

Reject unknown tool arguments instead of silently ignoring misspelled filters. Report saved-inventory I/O failures with corrective messages rather than resolved host paths, and preserve cancellation reasons during file operations.

Tool input schemas now set additionalProperties to false. Clients must send only declared arguments; previously unknown keys were accepted and ignored.
