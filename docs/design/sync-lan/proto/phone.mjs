// Process B – the "phone": reads the QR payload, finds the hub via mDNS, pairs, pushes N
// E2E-encrypted ops, pulls everything back, reconnects with the pinned key and runs two negative
// checks. Prints one JSON line with the measurements.
import crypto from 'node:crypto';
import net from 'node:net';
import { browse } from './mdns.mjs';
import { MODE, decodeQr, decryptValue, encryptValue, framer, initiate, isLanV4, keyPair } from './channel.mjs';

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
  want: (x) => x.txt.fp === qr.fp.subarray(0, 8).toString('hex'),
});
out.discoveryMs = ms(t);
if (!isLanV4(found.ip, allowTestNet)) throw new Error('hub is not on a private address');

const me = keyPair();
t = performance.now();
let sock = await connect(found.ip, found.port);
let ch = await initiate(framer(sock), { mode: MODE.PAIR, me, psk: qr.psk, expectFp: qr.fp });
const dataKey = Buffer.from((await ch.recv()).k, 'base64');
out.pairMs = ms(t);

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
ch = await initiate(framer(sock), { mode: MODE.SESSION, me, expectFp: qr.fp });
ch.send({ t: 'pull', since, limit: 1000 });
const empty = await ch.recv();
out.sessionMs = ms(t);
out.sessionUpToDate = empty.ops.length === 0;
ch.send({ t: 'bye' });
sock.end();

async function refused(fn) {
  const s = await connect(found.ip, found.port);
  try {
    const c = await fn(framer(s));
    c.send({ t: 'pull', since: 0, limit: 1 });
    await c.recv();
    return false;
  } catch {
    return true;
  } finally {
    s.destroy();
  }
}
// The QR's psk is single-use: a second pairing with it must fail.
out.reusedQrRefused = await refused((f) => initiate(f, { mode: MODE.PAIR, me: keyPair(), psk: qr.psk, expectFp: qr.fp }));
// An unpaired device without psk must be refused.
out.strangerRefused = await refused((f) => initiate(f, { mode: MODE.SESSION, me: keyPair(), expectFp: qr.fp }));
// A wrong hub key (e.g. a MITM answering instead) must be rejected by the phone.
out.wrongHubRefused = await refused((f) =>
  initiate(f, { mode: MODE.SESSION, me, expectFp: crypto.randomBytes(32) }),
);

process.stdout.write(`${JSON.stringify(out)}\n`);
