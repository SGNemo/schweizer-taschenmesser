#!/usr/bin/env node
/**
 * `npm run chats:sync`: prints the open pull requests as one table (lib/chatsSync.ts). Nothing is written:
 * the table is not part of docs/CHATS.md any more, because a snapshot committed by every branch conflicted
 * on nearly every merge.
 * Source of the open PRs, first match wins:
 *   --from <file>        JSON from a file (e.g. the GitHub MCP `list_pull_requests` answer, state open, perPage 100)
 *   stdin (pipe/file)    JSON on stdin, e.g. `gh api 'repos/SGNemo/schweizer-taschenmesser/pulls?state=open&per_page=100' | npm run chats:sync`
 *   otherwise            fetched with `gh api` (REST)
 */
import { execFileSync } from 'node:child_process';
import { fstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from './lib/args.ts';
import { fetchOpenPrs, normalizePrs, renderTable } from './lib/chatsSync.ts';

const args = parseArgs(process.argv.slice(2));
// npm runs scripts in web/; paths are meant relative to where the user called npm.
const cwd = process.env.INIT_CWD ?? process.cwd();
/** True when stdin carries data (a pipe or a redirected file), not a terminal or /dev/null. */
function stdinHasData() {
  try {
    const st = fstatSync(0);
    // Node hands a child's piped stdin over as a socket, a shell as a FIFO.
    return st.isFIFO() || st.isFile() || st.isSocket();
  } catch {
    return false;
  }
}

async function openPrs() {
  if (typeof args.from === 'string')
    return normalizePrs(JSON.parse(readFileSync(resolve(cwd, args.from), 'utf8')));
  if (stdinHasData()) {
    // Read as a stream: readFileSync(0) fails with EAGAIN while a pipe is still filling.
    let json = '';
    for await (const chunk of process.stdin) json += chunk;
    return normalizePrs(JSON.parse(json));
  }
  return fetchOpenPrs((cmd, cmdArgs) =>
    execFileSync(cmd, cmdArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
  );
}

try {
  const prs = await openPrs();
  console.log(`Open PRs (${prs.length}):\n\n${renderTable(prs)}`);
} catch (err) {
  console.error(`chats:sync: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
}
