---
'test-inventory-mcp': minor
---

An MCP server for test-inventory, with four read-only tools: `test_summary` counts tests by state, tag or file,
`find_tests` lists the tests that match filters, `get_tests` returns every key of tests by id, and `scan_diagnostics`
lists the problems the scan found. It serves both the 2026-07-28 revision of MCP and 2025 clients over stdio.
