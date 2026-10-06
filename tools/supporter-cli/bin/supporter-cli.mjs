#!/usr/bin/env node
import process from 'node:process';

// Type stripping (running .ts directly) is built into Node from 22.18.
const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  process.stderr.write(
    `Node ${process.versions.node} is too old: this tool needs Node 22.18 or newer.\n`,
  );
  process.exit(1);
}

let cli;
try {
  cli = await import('../src/cli.ts');
} catch (e) {
  if (e && e.code === 'ERR_MODULE_NOT_FOUND') {
    process.stderr.write(
      'Dependencies are missing. Run "npm ci" in packages/supporter-codes AND in tools/supporter-cli, then try again.\n',
    );
    process.exit(1);
  }
  throw e;
}

process.exitCode = await cli.run(process.argv.slice(2), cli.nodeIo());
