---
'test-inventory-mcp': patch
---

The server requires test-inventory 0.9.1, so its answers have that release's fixes: tests written as
`(process.env.CI ? it.skip : it)(...)` are listed, `.mocharc.yml`, `bunfig.toml`, Cypress and WebdriverIO spec patterns,
Jest's `moduleNameMapper` and Vite's `'@': '/src'` alias are read as the runners read them, Playwright 1.65's
`test.skip('reason')` gives the reason, and node:test and Bun skip states follow their describes. A `bunfig.toml` in a
scanned project can no longer change what later calls of a running server read.
