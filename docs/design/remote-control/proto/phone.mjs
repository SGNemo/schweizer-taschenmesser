// Remote-control prototype, phone side (process B). Run through `run.mjs`. Not product code.
// Generates touchpad moves like a finger on the screen and sends them in the variants the concept
// compares; the PC measures creation → applied.
import net from 'node:net';
import readline from 'node:readline';
import { framer, keyPair, initiate, MODE } from '../../sync-lan/proto/channel.mjs';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const ip = arg('ip');
const port = Number(arg('port'));
const hubPub = Buffer.from(arg('hubPub'), 'hex');
const DUR = Number(arg('dur') ?? 3000);

const keys = { full: keyPair(), media: keyPair(), none: keyPair() };
console.log(JSON.stringify(Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, v.pub.toString('hex')]))));
await new Promise((r) => readline.createInterface({ input: process.stdin }).once('line', r)); // PC set the grants

async function connect(me) {
  const t0 = performance.now();
  const sock = net.connect({ host: ip, port });
  await new Promise((res, rej) => sock.once('connect', res).once('error', rej));
  const f = framer(sock);
  const ch = await initiate(f, { mode: MODE.SESSION, me, hubPub });
  f.max = 1 << 20; // like the product client: raised once `hello` is sent
  return { ch, sock, ms: performance.now() - t0 };
}
const ts = () => Number(process.hrtime.bigint());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Calls `fn` at `hz` for DUR ms with drift correction. */
async function pace(hz, fn) {
  const start = performance.now();
  for (let i = 0; ; i++) {
    const due = start + (i * 1000) / hz;
    if (due - start > DUR) return i;
    const wait = due - performance.now();
    if (wait > 0) await sleep(wait);
    fn(i);
  }
}
const move = (i) => ['m', Math.round(6 * Math.cos(i / 9)), Math.round(6 * Math.sin(i / 9)), ts()];
const q = (xs, p) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] : null);
const round = (x) => (x == null ? null : Math.round(x * 100) / 100);
async function stats(ch, sent, bytes) {
  await sleep(50);
  ch.send({ t: 'stats' });
  const s = await ch.recv();
  return {
    sent,
    applied: s.applied,
    refused: s.refused,
    dropped: s.dropped,
    frames: s.frames,
    framesPerS: Math.round(s.frames / (DUR / 1000)),
    bytesPerS: bytes == null ? null : Math.round(bytes / (DUR / 1000)),
    p50: round(q(s.lat, 0.5)),
    p95: round(q(s.lat, 0.95)),
    max: round(q(s.lat, 1)),
  };
}
const wire = (o) => Buffer.byteLength(JSON.stringify(o)) + 16 + 4; // + AEAD tag + length prefix
/** A lock like `LanClient`'s `Mutex<Link>`: one request/response at a time. */
function lockstep(ch) {
  let tail = Promise.resolve();
  return (msg) => (tail = tail.then(async () => (ch.send(msg), ch.recv())));
}
const syncOps = Array.from({ length: 150 }, (_, i) => ({
  collection: 'tasks_items', id: `id-${i}`, field: 'title', hlc: `0001-${i}`, value: `enc:v1:${'A'.repeat(16)}:${'B'.repeat(160)}`,
}));
/** Sync pushes back to back (≈ 60 kB each, the product's frame limit) until `stop()`. */
function syncLoad(req) {
  let on = true;
  let rounds = 0;
  const done = (async () => {
    while (on) (await req({ t: 'sync', ops: syncOps }), rounds++, await sleep(0));
  })();
  return async () => ((on = false), await done, rounds);
}

const out = {};
const a = await connect(keys.full);
out.sessionMs = round(a.ms);

// 1 lockstep: one event per request/response through the lock (shape of today's `lan_client_request`)
{
  const req = lockstep(a.ch);
  const pending = [];
  const sent = await pace(120, (i) => pending.push(req({ t: 'in1', e: move(i) })));
  await Promise.all(pending);
  out.lockstep = await stats(a.ch, sent);
}
// 2 stream: one frame per event, no reply
{
  let bytes = 0;
  const sent = await pace(120, (i) => {
    const m = { t: 'in', e: [move(i)] };
    bytes += wire(m);
    a.ch.send(m);
  });
  out.stream = await stats(a.ch, sent, bytes);
}
// 3 stream bundled: 240 events/s collected, one frame per 8 ms tick
{
  let bytes = 0;
  let batch = [];
  const tick = setInterval(() => {
    if (!batch.length) return;
    const m = { t: 'in', e: batch };
    batch = [];
    bytes += wire(m);
    a.ch.send(m);
  }, 8);
  const sent = await pace(240, (i) => batch.push(move(i)));
  clearInterval(tick);
  if (batch.length) a.ch.send({ t: 'in', e: batch });
  out.bundled = await stats(a.ch, sent, bytes);
}
// 4 a sync round runs on the same session; input waits for the same lock (today's command shape)
{
  const req = lockstep(a.ch);
  const stop = syncLoad(req);
  const pending = [];
  const sent = await pace(120, (i) => pending.push(req({ t: 'in1', e: move(i) })));
  out.syncRoundsSameLock = await stop();
  await Promise.all(pending);
  out.sameSessionLocked = await stats(a.ch, sent);
}
// 4b sync on the same session, input as one-way frames between its requests (a new tag, same session)
{
  const stop = syncLoad(lockstep(a.ch));
  const sent = await pace(120, (i) => a.ch.send({ t: 'in', e: [move(i)] }));
  out.syncRoundsSameSession = await stop();
  out.sameSessionTag = await stats(a.ch, sent);
}
// 5 sync on session 1, input stream on a session of its own
{
  const b = await connect(keys.full);
  const stop = syncLoad(lockstep(a.ch));
  const sent = await pace(120, (i) => b.ch.send({ t: 'in', e: [move(i)] }));
  out.syncRoundsOwnSession = await stop();
  out.ownSession = await stats(b.ch, sent);
  b.sock.destroy();
}
// Checks
{
  const n = await connect(keys.none);
  for (let i = 0; i < 100; i++) n.ch.send({ t: 'in', e: [move(i)] });
  const s = await stats(n.ch, 100);
  out.refusedWithoutGrant = s.applied === 0 && s.refused === 100;
  n.sock.destroy();
  const m = await connect(keys.media);
  for (let i = 0; i < 50; i++) m.ch.send({ t: 'in', e: [['v', 1, 0, ts()], move(i)] });
  const t = await stats(m.ch, 100);
  out.mediaGrantRejectsPointer = t.applied === 50 && t.refused === 50;
  m.sock.destroy();
  a.ch.send({ t: 'stats' });
  await a.ch.recv(); // fresh bucket
  for (let i = 0; i < 50; i++) a.ch.send({ t: 'in', e: Array.from({ length: 100 }, (_, j) => move(j)) });
  const f = await stats(a.ch, 5000);
  out.floodCapped = f.applied <= 250 + 500 && f.dropped >= 4000;
  out.flood = { applied: f.applied, dropped: f.dropped };
}
console.log(JSON.stringify(out));
a.sock.destroy();
