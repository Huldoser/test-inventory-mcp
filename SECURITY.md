# Security policy

## Supported versions

Security fixes go into the latest release on npm. Before 1.0 there are no maintenance branches, so a fix comes out as
a patch of the latest minor version.

## Reporting a vulnerability

Report it privately through
[GitHub's private vulnerability reporting](https://github.com/Huldoser/test-inventory-mcp/security/advisories/new),
not in a public issue. Say which version is affected and how to reproduce it: the client, the tool call and the files
it read.

The server talks to its client over standard input and output only. It reads test files, configs, supported imports,
data dependencies and saved inventories. Tool arguments must stay within the configured project, and scan answers
are refused when their test files, configs or dependencies resolve outside it. A linked file may be read before the
answer is refused: this validation is not a filesystem sandbox. Use operating-system isolation when a project needs
a stronger read boundary.

A tool call that bypasses those argument or answer checks, runs project code, writes a file, opens a network
connection or puts anything other than MCP messages on standard output is a vulnerability. So is a problem in a
dependency that a tool call exposes. Package installation through `npx` is separate from the running server.

Test titles, skip reasons and other text in the answers come from the scanned files as they are written. A client
should treat them as content of that project, not as instructions. The client may send answers to its model provider;
the server's lack of network connections does not make that client interaction local.

You get a first reply within 14 days. Once the problem is confirmed, the fix is released as soon as it is ready, with a
GitHub security advisory that credits you unless you prefer not to be named.
