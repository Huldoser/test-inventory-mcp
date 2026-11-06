# test-inventory-mcp

An MCP server for [test-inventory](https://github.com/Huldoser/test-inventory): AI agents ask which tests a project
has, which are skipped and why, and which tests a change can affect, without running them.

It reads Playwright, Vitest, Jest, Mocha, Jasmine, Cypress, WebdriverIO, node:test and Bun test files with
test-inventory and answers from their source code. Nothing runs,
nothing is written, and nothing leaves your machine.

## Setup

Node.js 22.12 or newer. The client starts the server with `npx` and talks to it over standard input and output. The
server scans the test files your test runner's config runs, with the runner `--framework` names or, without
it, the one the project uses. Globs pick the files instead, as on test-inventory's command line.

**Claude Code**, in the project folder. `--scope project` writes `.mcp.json`, for everyone who works on the project:

```sh
claude mcp add --scope project test-inventory -- npx -y test-inventory-mcp@0.6 --framework playwright
```

**Cursor**, in `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "test-inventory": {
      "command": "npx",
      "args": ["-y", "test-inventory-mcp@0.6", "--framework", "playwright"]
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
      "args": ["-y", "test-inventory-mcp@0.6", "--framework", "playwright"]
    }
  }
}
```

Without `--framework`, as in a configuration shared by every project, each call scans with the runner the project
uses. In a project with several runners the agent passes `framework`, as the tools tell it, and `patterns` when it
wants other files than the configs run.

The project is the folder given with `--root`, otherwise the one Claude Code names in `CLAUDE_PROJECT_DIR`, otherwise
the folder the client starts the server in.

## Command line

```text
test-inventory-mcp [--framework <playwright|vitest|jest>] [<glob...>] [--root <dir>]
```

| Option               | Meaning                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `--framework <name>` | `playwright`, `vitest` or `jest`. Without it, the runner the project uses. A tool call can pass another. |
| `<glob...>`          | The test files, relative to the project, in place of those the configs run. A tool call can pass others. |
| `--root <dir>`       | The project. Tool calls can scan folders inside it, never outside.                                       |
| `-h`, `--help`       | Print the help.                                                                                          |
| `-v`, `--version`    | Print the version.                                                                                       |

## Tools

| Tool               | Answers                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `test_summary`     | Counts by state, tag and annotation, and the configs with their projects; with `groupBy`, the counts of each file, tag or project. |
| `find_tests`       | The tests that match `states`, `tags`, `grep`, `related`, `projects`, `only` or `withoutReason`, with the `fields` you pick.       |
| `get_tests`        | Every key of up to 20 tests by `ids`, with the scan's diagnostics about them; ids it can't find come back in `notFound`.           |
| `scan_diagnostics` | The problems the scan found, such as a file that failed to parse, by `levels`, `codes` or `path`.                                  |

`related` takes the files a change touches, from the project root as `git diff --name-only` writes them, and keeps
the tests whose `dependencies` include one of them, and those that reach code the scan can't follow, as
test-inventory's [`--related`](https://huldoser.github.io/test-inventory/guide/cli#tests-a-change-can-affect) does.
`dependencies` can list hundreds of files, so it isn't among the default `fields`, and `get_tests` returns as many
tests as fit in one answer, with the other ids in `remaining`. An id stays the same when a test moves to another
line, and changes when its title, describes or file change.

Every tool also takes `directory`, a folder inside the project to scan, and `framework` and `patterns`, relative to
`directory`, to override the command line, and `expandCases`, which lists each case of a `.each` or `.for` table and
each pass of a loop as its own test, with the name the runner gives it, as test-inventory's
[`--expand-cases`](https://huldoser.github.io/test-inventory/guide/cli) does. Ids differ with it, so `get_tests` takes
the same `expandCases` as the `find_tests` call the ids came from. Records have the keys of test-inventory's
[output format](https://huldoser.github.io/test-inventory/reference/output).

Answers are JSON, sent both as structured content and as text. Lists come 50 items at a time (`limit` takes up to
200), and an answer stays under about 30,000 characters; passing `nextCursor` back as `cursor` gets the next page.
`scanErrors` counts the problems that may leave tests out, and `hint` says what to do next when there is something to
say.

## Security

The server reads the test files its globs match inside the project, or without globs those the configs run, and,
for Vitest, the files that symbolic links among them point to, as Vitest does. It reads the configs as code, without
running them. It refuses a `directory` or pattern that reaches outside the project. It runs no code from the project, writes no files, and opens no network connections.

Answers hold text from the project's files, such as test titles, skip reasons and comments. A client should treat it
as content of that project, not as instructions. To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Versioning

Tool names, their arguments and their answers are the server's API. Before 1.0, a change that breaks them raises the
minor version, so `test-inventory-mcp@0.6` in the setup above gets fixes only.

## License

[MIT](LICENSE)
