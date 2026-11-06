// LAN sync prototype – run: `node docs/design/sync-lan/proto/run.mjs` (Node ≥ 20, no install).
// Starts hub (A) and phone (B) as separate processes ROUNDS times and prints a Markdown table.
// Env: ROUNDS (default 5), OPS (default 1000), LAN_IP (interface address; default: first non-internal IPv4).
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLanV4 } from './channel.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const ROUNDS = Number(process.env.ROUNDS ?? 5);
const OPS = Number(process.env.OPS ?? 1000);
const ip =
  process.env.LAN_IP ??
  Object.values(os.networkInterfaces())
    .flat()
    .find((i) => i.family === 'IPv4' && !i.internal)?.address;
if (!ip) throw new Error('no IPv4 interface');
// Containers often sit on TEST-NET (192.0.2.0/24); the product only accepts RFC 1918 / link-local.
const extra = isLanV4(ip) ? [] : ['--allow-test-net'];

/** Resolves with the next JSON line a child prints (call again for the following line). */
function lines(child) {
  const queue = [];
  const waiting = [];
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d;
    for (let i; (i = buf.indexOf('\n')) >= 0; ) {
      const v = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      waiting.length ? waiting.shift()(v) : queue.push(v);
    }
  });
  child.stderr.on('data', (d) => process.stderr.write(d));
  let failed = null;
  child.on('exit', (code) => code && (failed = new Error(`exit ${code}`)));
  return () =>
    queue.length
      ? Promise.resolve(queue.shift())
      : failed
        ? Promise.reject(failed)
        : new Promise((resolve) => waiting.push(resolve));
}

function lineOf(child) {
  return new Promise((resolve, reject) => {
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d;
      const i = buf.indexOf('\n');
      if (i >= 0) resolve(JSON.parse(buf.slice(0, i)));
    });
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('exit', (code) => code && reject(new Error(`exit ${code}`)));
  });
}

const runs = [];
for (let r = 0; r < ROUNDS; r++) {
  const hub = spawn(process.execPath, [path.join(dir, 'hub.mjs'), `--ip=${ip}`, `--ops=${OPS}`, ...extra]);
  try {
    const next = lines(hub);
    const { qr } = await next();
    if (r === 0) console.log(`QR payload (${qr.length} chars): ${qr.slice(0, 12)}…`);
    const phone = spawn(process.execPath, [path.join(dir, 'phone.mjs'), `--ip=${ip}`, `--ops=${OPS}`, `--qr=${qr}`, ...extra]);
    const result = await lineOf(phone);
    result.sasMatch = (await next()).sas === result.sas;
    runs.push(result);
  } finally {
    hub.kill();
  }
}

const keys = ['discoveryMs', 'pairMs', 'encryptMs', 'pushMs', 'pullMs', 'decryptMs', 'sessionMs'];
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log(`\nInterface ${ip}, ${ROUNDS} rounds, ${OPS} ops each way, Node ${process.version}, ${os.cpus()[0]?.model ?? '?'}\n`);
console.log('| Measure | median | min | max |\n|---|---|---|---|');
for (const k of keys) {
  const xs = runs.map((x) => x[k]);
  console.log(`| ${k} | ${median(xs)} | ${Math.min(...xs)} | ${Math.max(...xs)} |`);
}
const kb = Math.round(runs[0].pushBytes / 1024);
const push = median(runs.map((x) => x.pushMs));
const pull = median(runs.map((x) => x.pullMs));
console.log(`| push size | ${kb} KiB | | |`);
console.log(`| push throughput | ${Math.round((OPS / push) * 1000)} ops/s | | |`);
console.log(`| pull throughput (${runs[0].pulledOps} ops) | ${Math.round((runs[0].pulledOps / pull) * 1000)} ops/s | | |`);
const checks = ['decryptedOk', 'sasMatch', 'sessionUpToDate', 'reusedQrRefused', 'strangerRefused', 'impostorRefused', 'oversizeDropped'];
for (const c of checks) console.log(`check ${c}: ${runs.every((x) => x[c] === true) ? 'ok' : 'FAILED'}`);
if (!runs.every((x) => checks.every((c) => x[c] === true))) process.exit(1);
