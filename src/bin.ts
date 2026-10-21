#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { parseCommandLine } from './command-line.ts';
import { createServer } from './server.ts';

const command = parseCommandLine(process.argv.slice(2), process.env, process.cwd());
if ('config' in command) {
  const { config } = command;
  serveStdio(() => createServer(config));
} else {
  // Help and errors are for a person at a terminal; nothing is served, so standard output is free.
  (command.exitCode === 0 ? process.stdout : process.stderr).write(command.text);
  process.exitCode = command.exitCode;
}
