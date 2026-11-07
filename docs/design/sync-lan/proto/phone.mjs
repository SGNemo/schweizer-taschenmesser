// Process B – the "phone": reads the QR payload, finds the hub via mDNS, pairs, pushes N
// E2E-encrypted ops, pulls everything back, reconnects with the pinned key and runs negative checks
// (stranger / old-QR holder burning the window, reused QR, unpaired device, impostor hub, oversized frame).
// Prints {sas} first (for the simulated confirmation), then one JSON line with the results.
import crypto from 'node:crypto';
import net from 'node:net';
import { browse } from './mdns.mjs';
import { MODE, decodeQr, hintsAround, decryptValue, encryptValue, framer, initiate, isLanV4, keyPair, respond } from './channel.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const iface = arg('ip');
const allowTestNet = process.argv.includes('--allow-test-net');
const N = Number(arg('ops', '1000'));
const qr = decodeQr(arg('qr'));
const ms = (t) => Math.round((performance.now() - t) * 10) / 10;

function connect(host, port) {
  return new Promise((resolve, reject) => {
    const s = net.connect(port, host, () => resolve(s));
    s.once('error', reject);
  });
}

const out = {};
if (Date.now() > qr.expiresAt) throw new Error('qr expired');

let t = performance.now();
const found = await browse({
  service: '_nemo-sync._tcp.local',
  iface,
  want: (x) => hintsAround(qr.hubPub).includes(x.txt.h),
});
out.discoveryMs = ms(t);
if (!isLanV4(found.ip, allowTestNet)) throw new Error('hub is not on a private address');

// Before the real pairing, two attackers try to burn the window: a stranger without the hub key,
// and someone who has the hub key but not the current secret (old QR, revoked device, replay of an
// earlier window's message 1). Both must be dropped silently and the real pairing must still work.
async function burnAttempt(opts) {
  const s = await connect(found.ip, found.port);
  const err = await initiate(framer(s), { mode: MODE.PAIR, me: keyPair(), ...opts }).then(
    () => 'paired',
    (e) => e.message,
  );
  s.destroy();
  return err;
}
const strangerErr = await burnAttempt({ psk: qr.psk, hubPub: keyPair().pub });
const oldQrErr = await burnAttempt({ psk: crypto.randomBytes(16), hubPub: qr.hubPub });
const dropped = (m) => /^closed$|ECONNRESET|EPIPE|pairing-not-possible/.test(m);

const me = keyPair();
t = performance.now();
let sock = await connect(found.ip, found.port);
let ch = await initiate(framer(sock), { mode: MODE.PAIR, me, psk: qr.psk, hubPub: qr.hubPub });
out.sas = ch.sas;
process.stdout.write(`${JSON.stringify({ sas: ch.sas })}\n`); // run.mjs compares and confirms on the hub
const dataKey = Buffer.from((await ch.recv()).k, 'base64');
out.pairMs = ms(t); // includes the simulated confirmation round trip
out.windowSurvivedStranger = dropped(strangerErr);
out.oldQrHolderCannotBurn = dropped(oldQrErr); // and the pairing above still succeeded

t = performance.now();
const ops = [];
for (let i = 0; i < N; i++) {
  const op = { collection: 'todos_task', id: `ph${i}`, field: 'title', hlc: `${String(1_790_000_100_000 + i).padStart(13, '0')}-0000-phone1` };
  op.value = encryptValue(dataKey, op, `Aufgabe vom Handy Nummer ${i} – etwas Text für eine realistische Länge`);
  ops.push(op);
}
out.encryptMs = ms(t);
out.pushBytes = Buffer.byteLength(JSON.stringify({ t: 'push', ops }));

t = performance.now();
ch.send({ t: 'push', ops });
const ack = await ch.recv();
out.pushMs = ms(t);

t = performance.now();
let since = 0;
let pulled = [];
for (;;) {
  ch.send({ t: 'pull', since, limit: 1000 });
  const page = await ch.recv();
  pulled = pulled.concat(page.ops);
  since = page.cursor;
  if (!page.more) break;
}
out.pullMs = ms(t);
out.pulledOps = pulled.length;

t = performance.now();
const fromPc = pulled.filter((o) => o.collection === 'notes_note').map((o) => decryptValue(dataKey, o));
out.decryptMs = ms(t);
out.decryptedOk = fromPc.length === N && fromPc.every((v, i) => v.includes(`Nummer ${i} `));
out.serverSeq = ack.seq;
ch.send({ t: 'bye' });
sock.end();

// Reconnect: no QR, no psk – the hub must recognise the paired key, the phone pins the hub key.
t = performance.now();
sock = await connect(found.ip, found.port);
ch = await initiate(framer(sock), { mode: MODE.SESSION, me, hubPub: qr.hubPub });
ch.send({ t: 'pull', since, limit: 1000 });
const empty = await ch.recv();
out.sessionMs = ms(t);
out.sessionUpToDate = empty.ops.length === 0;
ch.send({ t: 'bye' });
sock.end();

/** Returns the error message of a refused attempt (`null` if it was NOT refused). */
async function attempt(fn, port = found.port) {
  const s = await connect(found.ip, port);
  try {
    const c = await fn(framer(s));
    c.send({ t: 'pull', since: 0, limit: 1 });
    await c.recv();
    return null;
  } catch (e) {
    return e.message;
  } finally {
    s.destroy();
  }
}
// The QR's psk is single-use: a second pairing with it is dropped silently (phone: "am PC neu zeigen").
out.reusedQrRefused =
  (await attempt((f) => initiate(f, { mode: MODE.PAIR, me: keyPair(), psk: qr.psk, hubPub: qr.hubPub }))) ===
  'pairing-not-possible';
// An unpaired device that even knows the hub key (old QR) gets a refusal authenticated by the hub.
out.strangerRefused =
  (await attempt((f) => initiate(f, { mode: MODE.SESSION, me: keyPair(), hubPub: qr.hubPub }))) ===
  'refused:unknown-device';
// An impostor hub (other key, e.g. after ARP spoofing) cannot read message 1 and cannot answer.
const impostor = net.createServer((s) =>
  respond(framer(s), { me: keyPair(), peekPsk: () => qr.psk, burn() {}, trusts: () => true }).catch(() => s.destroy()),
);
await new Promise((r) => impostor.listen(0, found.ip, r));
const imp = await attempt((f) => initiate(f, { mode: MODE.SESSION, me, hubPub: qr.hubPub }), impostor.address().port);
out.impostorRefused = imp !== null && !imp.startsWith('refused:'); // connection dropped, no session
impostor.close();
// Before authentication the hub drops frames above 256 bytes (connection closed, no refusal code).
{
  const s = await connect(found.ip, found.port);
  const f = framer(s, 1 << 30);
  const big = Buffer.alloc(4 + 1024 * 1024);
  big.writeUInt32BE(1024 * 1024);
  s.write(big);
  out.oversizeDropped = await f.read().then(
    () => false,
    (e) => /^closed$|ECONNRESET|EPIPE/.test(e.message), // closed or reset, never a refusal code
  );
  s.destroy();
}

process.stdout.write(`${JSON.stringify(out)}\n`);
