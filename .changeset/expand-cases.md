---
'test-inventory-mcp': minor
---

Requires test-inventory 0.7.0, so a server npx starts installs again and works out values imported from project files
and counts loops over known values. Every tool takes a new `expandCases` argument, which lists each case of a `.each`
or `.for` table and each pass of a loop as its own test, with the name the runner gives it and `caseIndex`; `get_tests`
takes it too, as the ids of expanded tests differ. Answers have test-inventory 0.7.0's new `caseIndex` key and
`cases-not-expanded` diagnostic.
