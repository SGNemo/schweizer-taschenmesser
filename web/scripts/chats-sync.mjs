#!/usr/bin/env node
/**
 * `npm run chats:sync`: rewrites the generated open-PR block of docs/CHATS.md (lib/chatsSync.ts).
 * Source of the open PRs, first match wins:
 *   --from <file>        JSON from a file (e.g. the GitHub MCP `list_pull_requests` answer, state open, perPage 100)
 *   stdin (pipe/file)    JSON on stdin, e.g. `gh api 'repos/SGNemo/schweizer-taschenmesser/pulls?state=open&per_page=100' | npm run chats:sync`
 *   otherwise            fetched with `gh api` (REST)
 * The list must be complete: a PR missing from it counts as closed and loses its row.
 * Flags: --doc <file> (default docs/CHATS.md), --check (exit 1 when the block is stale, writes nothing).
 * Run it before your PR's last commit; on a merge conflict in the block, take either side and run it again.
 */
import { execFileSync } from 'node:child_process';
import { fstatSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.ts';
import { fetchOpenPrs, isCurrent, normalizePrs, syncDoc } from './lib/chatsSync.ts';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = parseArgs(process.argv.slice(2));
// npm runs scripts in web/; paths are meant relative to where the user called npm.
const cwd = process.env.INIT_CWD ?? process.cwd();
const docPath =
  typeof args.doc === 'string' ? resolve(cwd, args.doc) : resolve(repo, 'docs/CHATS.md');

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
  const doc = readFileSync(docPath, 'utf8');
  if (args.check) {
    if (isCurrent(doc, prs)) {
      console.log(`chats:sync: block is current (${prs.length} open PRs)`);
    } else {
      console.error(`chats:sync: the open-PR block in ${docPath} is stale; run npm run chats:sync`);
      process.exit(1);
    }
  } else {
    const next = syncDoc(doc, prs);
    if (next !== doc) writeFileSync(docPath, next);
    console.log(`chats:sync: ${prs.length} open PRs ${next === doc ? '(no change)' : 'written'}`);
  }
} catch (err) {
  console.error(`chats:sync: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
}
