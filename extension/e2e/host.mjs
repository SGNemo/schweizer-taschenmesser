#!/usr/bin/env node
// Test stand-in for the native messaging host (the real one is the Nemo executable, see
// web/src-tauri/crates/vault-bridge). Same job: read framed JSON from the browser, stamp the
// browser-reported origin, hand it to the app (here: an HTTP relay into the real app page), and
// write the framed reply back. When nothing listens it answers `app-not-running` itself.
import http from 'node:http';

const origin = process.argv[2] ?? '';
const port = Number(process.env.NEMO_TEST_RELAY_PORT ?? 0);
const MAX = 64 * 1024;

function post(body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/relay',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      },
      (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () =>
          res.statusCode === 200 ? resolve(text) : reject(new Error(String(res.statusCode))),
        );
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

function write(text) {
  const payload = Buffer.from(text, 'utf8');
  const head = Buffer.alloc(4);
  head.writeUInt32LE(payload.length, 0);
  process.stdout.write(Buffer.concat([head, payload]));
}

const error = (id, code) => JSON.stringify({ v: 1, id, ok: false, error: code });

let buffer = Buffer.alloc(0);
let chain = Promise.resolve();
process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length >= 4) {
    const len = buffer.readUInt32LE(0);
    if (len > MAX) process.exit(1);
    if (buffer.length < 4 + len) break;
    const message = buffer.subarray(4, 4 + len).toString('utf8');
    buffer = buffer.subarray(4 + len);
    chain = chain.then(async () => {
      let id = '';
      try {
        const value = JSON.parse(message);
        id = typeof value.id === 'string' ? value.id : '';
        value.origin = origin; // the browser's word, not the sender's
        write(await post(JSON.stringify(value)));
      } catch {
        write(error(id, 'app-not-running'));
      }
    });
  }
});
process.stdin.on('end', () => process.exit(0));
