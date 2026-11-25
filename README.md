# test-inventory-mcp

An MCP server for [test-inventory](https://github.com/Huldoser/test-inventory): give AI coding agents direct tools to list tests, inspect skip reasons, diff saved inventories and get the runner commands for changed files, without running the suite.

It reads Playwright, Vitest, Jest, Mocha, Jasmine, Cypress, WebdriverIO, node:test and Bun test files and configs from source. The running server executes no project code, writes no files and opens no network connections. Installation through `npx` may download packages, and answers are passed to your MCP client (whose model provider and privacy settings govern what happens to that text next).

Documentation: [huldoser.github.io/test-inventory](https://huldoser.github.io/test-inventory/) · [CLI and library](https://github.com/Huldoser/test-inventory) · [GitHub Action for PR comments](https://github.com/Huldoser/test-inventory-action)

## Setup

Requires Node.js 22.12 or newer. The client starts the server with `npx` over stdio; by default the server detects your test runner and reads its config automatically.

**Claude Code**, in your project folder (`--scope project` writes `.mcp.json` for the whole team):

```sh
claude mcp add --scope project test-inventory -- npx -y test-inventory-mcp@latest
```

**Cursor**, in `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "test-inventory": {
      "command": "npx",
      "args": ["-y", "test-inventory-mcp@latest"]
    }
  }
}
```

**VS Code**, in `.vscode/mcp.json`:

```json
{
  "servers": {
    "test-inventory": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "test-inventory-mcp@latest"]
    }
  }
}
```

In a repository with several runners (for example Vitest and Playwright), either append `--framework <name>` to the config or leave it out and let the agent pass `framework` per call. Pass globs to override config file selection, or let the agent pass `patterns`.

The scanned project defaults to `--root`, then Claude Code's `CLAUDE_PROJECT_DIR`, then the folder the client starts the server in.

### Verify and try it

1. Confirm `test-inventory` is connected in your client: `/mcp` in Claude Code, **MCP: List Servers** in VS Code, or MCP settings in Cursor.
2. Confirm the client lists `test_summary`, then ask:

> Use test-inventory to summarize this project's tests.

3. Check that `test_summary` reports the expected framework and file counts. If `scanErrors` is nonzero, ask the agent to call `scan_diagnostics` before trusting the counts.

Example prompts once connected:

- _"Which tests should I run after changing `pages/orders-blotter.ts`?"_ The agent calls `get_run_commands` with `related` and gets the exact runner command for your shell.
- _"List tests marked skip or fixme, with their conditions and reasons."_ The agent calls `find_tests` with `states` and `fields` and returns each match's `fullName`, `state`, `condition` and `reason`.
- _"What changed between `inventories/base.json` and `inventories/head.json`?"_ The agent calls `diff_inventories` with `before` and `after`.

For example, `get_run_commands` for `pages/orders-blotter.ts` in a Playwright project returns:

```text
npx playwright test tests/orders/limit-orders.spec.ts tests/orders/market-orders.spec.ts tests/orders/order-lifecycle.spec.ts tests/portfolio.spec.ts --config playwright.config.ts --project chromium webkit
```

Declared states describe source code, not execution results: a conditional skip is not proof a test was skipped in a run, and expected-to-fail tests execute. See [key concepts](https://huldoser.github.io/test-inventory/guide/concepts).

## Command line

```text
test-inventory-mcp [--framework <name>] [<glob...>] [--root <dir>]
```

| Option               | Meaning                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--framework <name>` | `playwright`, `vitest`, `jest`, `mocha`, `jasmine`, `cypress`, `webdriverio`, `node` or `bun`. Without it, the runner the project uses. A tool call can pass another. |
| `<glob...>`          | The test files, relative to the project, in place of those the configs run. A tool call can pass others.                                                              |
| `--root <dir>`       | The project. Tool calls can scan folders inside it, never outside.                                                                                                    |
| `-h`, `--help`       | Print the help.                                                                                                                                                       |
| `-v`, `--version`    | Print the version.                                                                                                                                                    |

## Tools

The generated [tool reference](https://github.com/Huldoser/test-inventory-mcp/blob/main/docs/tools.md) lists each argument's type, default and bounds, response fields, complete request/response examples, pagination and errors. It is checked against the running server in tests.

| Tool               | Answers                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `test_summary`     | Counts by state, tag and annotation, and the configs with their projects; with `groupBy`, the counts of each file, tag or project. |
| `find_tests`       | The tests that match `states`, `tags`, `grep`, `related`, `projects`, `only` or `withoutReason`, with the `fields` you pick.       |
| `get_tests`        | Every key of up to 20 tests by `ids`, with the scan's diagnostics about them; ids it can't find come back in `notFound`.           |
| `scan_diagnostics` | The problems the scan found, such as a file that failed to parse, by `levels`, `codes` or `path`.                                  |
| `diff_inventories` | Changes between saved scans named by `before` and `after`, including renames, moves and newly declared skip states.                |
| `get_run_commands` | Runner commands for the test files a change (`related`) can affect, with their configs, projects, files and runner caveats.        |

Pass `get_run_commands` a nonempty `related` list, such as `{"related":["tests/login.spec.ts"]}`. It uses the same changed-file matching as `find_tests`. Run a returned command from the scanned `directory` in a POSIX shell. Each command selects whole files; a runner can collect additional tests, and the response includes any caveat from the core scanner. The server never executes the commands.

A typical call sequence is `test_summary`, `find_tests`, then `get_tests` for a few returned ids. For example, the arguments to `find_tests` can be:

```json
{
  "states": ["skip", "fixme"],
  "fields": ["fullName", "state", "condition", "reason"],
  "limit": 10
}
```

The answer contains matching `tests`, their `total`, `scanErrors`, `nextCursor` and `hint`, plus the framework and its version. The records have selected keys and their `id`. Pass a non-null `nextCursor` as `cursor` with the same other arguments to read another page; a narrow filter returning zero tests is a valid result.

`related` takes the files a change touches, from the project root as `git diff --name-only` writes them, and keeps tests that depend on a changed file, match it through a literal `import.meta.glob` pattern, or reach code the scan can't follow, as test-inventory's [`--related`](https://huldoser.github.io/test-inventory/guide/cli#tests-a-change-can-affect) does. Request `dependencyGlobs` in `fields` to see the patterns; they can match new or deleted files. The filter uses the actual scanned folder when `directory` names an internal link or an absolute path inside the project, and keeps tests that import a changed helper elsewhere in the project outside that scanned folder. `dependencies` can list hundreds of files, so it isn't among the default `fields`, and `get_tests` returns as many tests as fit in one answer, with the other ids in `remaining`. An id stays the same when a test moves to another line, and changes when its title, describes or file change.

Every scan tool also takes `directory`, a folder inside the project to scan, `framework` and `patterns` (relative to `directory`) to override the command line, and `expandCases`, which lists each case of a `.each` or `.for` table and each pass of a loop as its own test, as test-inventory's [`--expand-cases`](https://huldoser.github.io/test-inventory/guide/cli) does. Ids differ with it, so `get_tests` takes the same `expandCases` as the `find_tests` call the ids came from. Records have the keys of test-inventory's [output format](https://huldoser.github.io/test-inventory/reference/output).

Unknown tool arguments are refused with an error naming the unrecognized key, so misspelled filters are not silently ignored.

Answers are JSON, sent both as structured content and as text. Lists come 50 items at a time (`limit` takes up to 200), and an answer stays under about 30,000 characters; passing `nextCursor` back as `cursor` gets the next page. A single oversized record is returned alone. A final page can fit more records because it needs no next-page cursor or hint. `scanErrors` counts the problems that may leave tests out, and `hint` says what to do next when there is something to say.

### Compare saved inventories

`diff_inventories` takes `before` and `after`, paths to complete saved JSON inventories inside the project, plus `limit` and `cursor`. It returns paged `changes` with original records and matching evidence, the full `summary`, `total`, `nextCursor`, `hashesComparable`, `warnings` and `hint`. It does not scan or write files. Use the same framework, root, patterns, filters and `expandCases` setting for both scans. Hash comparisons and rename matching need the exact same core version. Incomplete scans produce warnings. Zero changes returns an empty page and a hint. A conditional skip becoming unconditional counts as `newlySkipped`, and the reverse counts as `reEnabled`. Each saved file must be a regular file of at most 128 MiB. Save scans with the core CLI, without `--fields` or `--format jsonl`; see [inventory diffs](https://huldoser.github.io/test-inventory/guide/diff). If a saved file disappears or becomes unreadable while opening it, the error names the supplied file and suggests checking its existence and readability, without exposing the resolved host path. Cancellation during these operations retains the request's cancellation reason.

## Troubleshooting

| Symptom                                         | Next step                                                                                                                                                                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The server is disconnected or tools are missing | Open the client's server logs. Check that the client can find Node.js 22.12 or newer and `npx`, then restart the server through the client. A client launched by a desktop app may use a different PATH from your terminal. |
| No files or tests were found                    | Check `--root`, `directory`, the framework and the config's selected files. Try explicit `patterns`, such as `["tests/**/*.spec.ts"]`. Call `scan_diagnostics` for details.                                                 |
| Several runners were detected                   | Pass `framework` on the call, or set `--framework` in the server configuration. Scan each runner separately.                                                                                                                |
| The answer has `scanErrors`                     | Call `scan_diagnostics` and resolve the errors before treating the inventory as complete.                                                                                                                                   |
| A path is refused                               | Keep the scanned files and dependencies inside the configured project. For an intended shared dependency, start the server at the shared parent and use `directory` to select a package.                                    |
| A cursor is refused                             | Start the query again without `cursor`; keep filters, directory and case expansion unchanged when requesting later pages. Files may have changed between calls.                                                             |
| `get_tests` cannot find an id                   | Obtain current ids from `find_tests`. Keep its `directory`, `framework`, `patterns` and `expandCases` settings.                                                                                                             |
| A saved scan is refused                         | Use complete JSON inventories, not JSON Lines or `--fields` output. Keep both files inside the project and below the size limit.                                                                                            |

For incorrect source analysis, use the core's [troubleshooting guide](https://huldoser.github.io/test-inventory/guide/troubleshooting). For a server bug, include the server version, client, tool arguments, expected answer and a minimal reproduction. Remove private project data before sharing it.

## Security

The server reads the test files its globs match inside the project, or without globs those the configs run, and, for Vitest, the files that symbolic links among them point to, as Vitest does. It reads the configs as code, without running them. It refuses a `directory` or pattern that reaches outside the project, including parent-directory components in brace or extglob alternatives, and refuses scan answers whose test files, configs or dependencies resolve outside it. Saved inventories must resolve inside the project too. The scanner may read a linked file before the answer is refused; this boundary is not a filesystem sandbox. It runs no code from the project, writes no files, and opens no network connections.

Answers hold text from the project's files, such as test titles, skip reasons and comments. A client should treat it as content of that project, not as instructions. The client's handling of that text is separate from the server's local operation. To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Versioning

Tool names, their arguments and their answers are the server's API. Before 1.0, a change that breaks them raises the minor version. The setup examples use `test-inventory-mcp@latest` so each launch requests npm's latest published release. If npm enforces a minimum release age, `npx` can select an earlier version until the new release is old enough. Requires [test-inventory 0.12.2](https://github.com/Huldoser/test-inventory/releases/tag/v0.12.2) or a later 0.12 patch; see [CHANGELOG.md](CHANGELOG.md) for release notes.

## License

[MIT](LICENSE)
