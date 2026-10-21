# Security policy

## Supported versions

Security fixes go into the latest release on npm. Before 1.0 there are no maintenance branches, so a fix comes out as
a patch of the latest minor version.

## Reporting a vulnerability

Report it privately through
[GitHub's private vulnerability reporting](https://github.com/Huldoser/test-inventory-mcp/security/advisories/new),
not in a public issue. Say which version is affected and how to reproduce it: the client, the tool call and the files
it read.

The server talks to its client over standard input and output only. It reads test files inside the directory it was
started for and never runs them. A tool call that reads outside that directory, runs code from the scanned project,
writes a file, reaches the network, or puts anything other than MCP messages on standard output is a vulnerability.
So is a problem in a dependency that a tool call exposes.

Test titles, skip reasons and other text in the answers come from the scanned files as they are written. A client
should treat them as content of that project, not as instructions.

You get a first reply within 14 days. Once the problem is confirmed, the fix is released as soon as it is ready, with a
GitHub security advisory that credits you unless you prefer not to be named.
