#!/usr/bin/env node
/**
 * `npm run chats:sync`: rewrites the generated open-PR block of docs/CHATS.md (lib/chatsSync.ts).
 * No network: the open PRs come as JSON from a file (`--from prs.json`) or from stdin, e.g.
 *   gh api 'repos/SGNemo/schweizer-taschenmesser/pulls?state=open&per_page=100' | npm run chats:sync
 * or the answer of the GitHub MCP `list_pull_requests` (state open, perPage 100) saved to a file.
 * The list must be complete: a PR missing from it counts as closed and loses its row.
 * Flags: --from <file>, --doc <file> (default docs/CHATS.md), --check (exit 1 when the block is stale,
 * writes nothing).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.ts';
import { isCurrent, normalizePrs, syncDoc } from './lib/chatsSync.ts';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = parseArgs(process.argv.slice(2));
// npm runs scripts in web/; paths are meant relative to where the user called npm.
const cwd = process.env.INIT_CWD ?? process.cwd();
const docPath =
  typeof args.doc === 'string' ? resolve(cwd, args.doc) : resolve(repo, 'docs/CHATS.md');

if (typeof args.from !== 'string' && process.stdin.isTTY) {
  console.error(
    'chats:sync needs the open PRs as JSON: --from <file> or on stdin\n' +
      "  gh api 'repos/SGNemo/schweizer-taschenmesser/pulls?state=open&per_page=100' | npm run chats:sync",
  );
  process.exit(2);
}

try {
  // stdin is read as a stream: readFileSync(0) fails with EAGAIN while a pipe is still filling.
  let json = '';
  if (typeof args.from === 'string') json = readFileSync(resolve(cwd, args.from), 'utf8');
  else for await (const chunk of process.stdin) json += chunk;
  const prs = normalizePrs(JSON.parse(json));
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
