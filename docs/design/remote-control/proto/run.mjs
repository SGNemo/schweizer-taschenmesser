// Remote-control prototype – run: `node docs/design/remote-control/proto/run.mjs` (Node ≥ 20, no install).
// Starts the PC (A) and the phone (B) as separate processes ROUNDS times, talks over the interface
// address, and prints a Markdown table: input latency (event created on the phone → applied on the
// PC) per transport variant. Env: ROUNDS (default 5), DUR ms per variant (default 3000), LAN_IP.
// It injects nothing into the OS, and its channel is the Noise-like one of the sync prototype.
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLanV4 } from '../../sync-lan/proto/channel.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const ROUNDS = Number(process.env.ROUNDS ?? 5);
const DUR = Number(process.env.DUR ?? 3000);
const STORE_MS = Number(process.env.STORE_MS ?? 15); // assumed store commit per sync push (see pc.mjs)
const ip =
  process.env.LAN_IP ??
  Object.values(os.networkInterfaces())
    .flat()
    .find((i) => i.family === 'IPv4' && !i.internal)?.address;
if (!ip) throw new Error('no IPv4 interface');
const extra = isLanV4(ip) ? [] : ['--allow-test-net']; // containers often sit on TEST-NET

function nextLine(child) {
  let buf = '';
  const queue = [];
  const waiting = [];
  child.stdout.on('data', (d) => {
    buf += d;
    for (let i; (i = buf.indexOf('\n')) >= 0; buf = buf.slice(i + 1)) {
      const v = JSON.parse(buf.slice(0, i));
      waiting.length ? waiting.shift()(v) : queue.push(v);
    }
  });
  child.stderr.on('data', (d) => process.stderr.write(d));
  child.on('exit', (code) => code && (console.error(`child exit ${code}`), process.exit(1)));
  return () => (queue.length ? Promise.resolve(queue.shift()) : new Promise((r) => waiting.push(r)));
}

const runs = [];
for (let r = 0; r < ROUNDS; r++) {
  const pc = spawn(process.execPath, [path.join(dir, 'pc.mjs'), `--ip=${ip}`, `--storeMs=${STORE_MS}`, ...extra]);
  try {
    const { port, hubPub } = await nextLine(pc)();
    const phone = spawn(process.execPath, [path.join(dir, 'phone.mjs'), `--ip=${ip}`, `--port=${port}`, `--hubPub=${hubPub}`, `--dur=${DUR}`]);
    const fromPhone = nextLine(phone);
    const keys = await fromPhone();
    for (const [grant, key] of Object.entries(keys)) pc.stdin.write(`grant ${key} ${grant}\n`); // set on the PC only
    await new Promise((res) => setTimeout(res, 50));
    phone.stdin.write('go\n');
    runs.push(await fromPhone());
    phone.kill();
  } finally {
    pc.kill();
  }
}

const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const rows = [
  ['lockstep', '1 request/response per event (today\'s command shape), 120 ev/s'],
  ['stream', '2 one-way frame per event, 120 ev/s'],
  ['bundled', '3 one-way, bundled every 8 ms, 240 ev/s'],
  ['sameSessionLocked', '4 as 1, while sync pushes hold the same session and lock'],
  ['sameSessionTag', '4b as 2 on the same session, between sync pushes'],
  ['ownSession', '5 as 2 on a session of its own, while sync runs'],
];
console.log(`Interface ${ip}, ${ROUNDS} rounds × ${DUR} ms per variant, assumed store commit ${STORE_MS} ms, Node ${process.version}, ${os.cpus()[0]?.model ?? '?'}\n`);
console.log('| Variant | p50 ms | p95 ms | max ms | frames/s | bytes/s | applied/sent |');
console.log('|---|---|---|---|---|---|---|');
for (const [k, label] of rows) {
  const xs = runs.map((x) => x[k]);
  const m = (f) => med(xs.map((x) => x[f]));
  console.log(`| ${label} | ${m('p50')} | ${m('p95')} | ${Math.max(...xs.map((x) => x.max))} | ${m('framesPerS')} | ${m('bytesPerS') ?? '–'} | ${m('applied')}/${m('sent')} |`);
}
console.log(`| session setup (TCP + handshake + hello) | ${med(runs.map((x) => x.sessionMs))} | | ${Math.max(...runs.map((x) => x.sessionMs))} | | | |`);
console.log(`\nSync pushes during 4 / 4b / 5 (median): ${med(runs.map((x) => x.syncRoundsSameLock))} / ${med(runs.map((x) => x.syncRoundsSameSession))} / ${med(runs.map((x) => x.syncRoundsOwnSession))}`);
console.log(`Flood of 5000 events at once (median): applied ${med(runs.map((x) => x.flood.applied))}, dropped ${med(runs.map((x) => x.flood.dropped))}`);
for (const c of ['refusedWithoutGrant', 'mediaGrantRejectsPointer', 'floodCapped'])
  console.log(`${c}: ${runs.every((x) => x[c] === true) ? 'ok' : 'FAILED'} (${ROUNDS} rounds)`);
