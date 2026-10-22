# test-inventory-mcp

An MCP server for [test-inventory](https://github.com/Huldoser/test-inventory): AI agents ask which tests a project
has, which are skipped and why, without running them.

It reads Playwright and Vitest test files with test-inventory and answers from their source code. Nothing runs,
nothing is written, and nothing leaves your machine.

## Setup

Node.js 22.12 or newer. The client starts the server with `npx` and talks to it over standard input and output. Give
it the globs of your test files and the framework, as you would to test-inventory's command line.

**Claude Code**, in the project folder. `--scope project` writes `.mcp.json`, for everyone who works on the project:

```sh
claude mcp add --scope project test-inventory -- npx -y test-inventory-mcp@0.2 "tests/**/*.spec.ts" --framework playwright
```

**Cursor**, in `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "test-inventory": {
      "command": "npx",
      "args": ["-y", "test-inventory-mcp@0.2", "tests/**/*.spec.ts", "--framework", "playwright"]
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
      "args": ["-y", "test-inventory-mcp@0.2", "tests/**/*.spec.ts", "--framework", "playwright"]
    }
  }
}
```

Without globs, as in a configuration shared by every project, the agent passes `framework` and `patterns` in each
call; the tools say so when they are missing.

The project is the folder given with `--root`, otherwise the one Claude Code names in `CLAUDE_PROJECT_DIR`, otherwise
the folder the client starts the server in.

## Command line

```text
test-inventory-mcp [<glob...> --framework <playwright|vitest>] [--root <dir>]
```

| Option                | Meaning                                                               |
| --------------------- | --------------------------------------------------------------------- |
| `<glob...>`           | The test files, relative to the project. A tool call can pass others. |
| `--framework <name>`  | `playwright` or `vitest`, for the globs.                              |
| `--root <dir>`        | The project. Tool calls can scan folders inside it, never outside.    |
| `--help`, `--version` | Print the help or the version.                                        |

## Tools

| Tool               | Answers                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `test_summary`     | Counts by state, tag and annotation; with `groupBy`, the counts of each file or tag.                  |
| `find_tests`       | The tests that match `states`, `tags`, `grep`, `only` or `withoutReason`, with the `fields` you pick. |
| `get_tests`        | Every key of up to 20 tests by id, with the scan's diagnostics about them.                            |
| `scan_diagnostics` | The problems the scan found, such as a file that failed to parse, by level, code or path.             |

Every tool also takes `directory`, a folder inside the project to scan, and `framework` and `patterns` to override
the command line. Records have the keys of test-inventory's
[output format](https://huldoser.github.io/test-inventory/reference/output).

Answers are JSON, sent both as structured content and as text. Lists come 50 items at a time (`limit` takes up to
200), and an answer stays under about 30,000 characters; `nextCursor` gets the next page. `scanErrors` counts the
problems that may leave tests out, and `hint` says what to do next when there is something to say.

## Security

The server reads the test files its globs match inside the project, and, for Vitest, the files that symbolic links
among them point to, as Vitest does. It refuses a `directory` or pattern that reaches outside the project. It runs no code from the project, writes no files, and opens no network connections.

Answers hold text from the project's files, such as test titles, skip reasons and comments. A client should treat it
as content of that project, not as instructions. To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Versioning

Tool names, their arguments and their answers are the server's API. Before 1.0, a change that breaks them raises the
minor version, so `test-inventory-mcp@0.2` in the setup above gets fixes only.

## License

[MIT](LICENSE)
