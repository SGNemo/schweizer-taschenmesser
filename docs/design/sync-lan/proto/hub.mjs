// Process A – the "PC hub": announces itself via mDNS, opens a 2-minute one-time pairing window,
// prints the QR payload, then serves push/pull of E2E-encrypted ops over the encrypted channel.
// The store is an append-only log with a sequence number and NO merge rule: in the product the
// hub applies ops through the existing `mergeOps` (web/src/core/sync/ops.ts), see CONCEPT.md §3.
import crypto from 'node:crypto';
import net from 'node:net';
import { announce } from './mdns.mjs';
import { MODE, encodeQr, encryptValue, fingerprint, framer, isLanV4, keyPair, respond } from './channel.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const ip = arg('ip');
const allowTestNet = process.argv.includes('--allow-test-net');
const N = Number(arg('ops', '1000'));

const me = keyPair();
const dataKey = crypto.randomBytes(32); // E2E data key; leaves the hub only inside the paired channel
const trusted = new Set();
let pairing = { psk: crypto.randomBytes(16), expiresAt: Date.now() + 120_000 };

const log = [];
for (let i = 0; i < N; i++) {
  const op = { collection: 'notes_note', id: `pc${i}`, field: 'title', hlc: `${String(1_790_000_000_000 + i).padStart(13, '0')}-0000-pc1` };
  op.value = encryptValue(dataKey, op, `Notiz vom PC Nummer ${i} – etwas Text für eine realistische Länge`);
  log.push({ seq: log.length + 1, op });
}

const server = net.createServer(async (sock) => {
  if (!isLanV4(sock.remoteAddress.replace(/^::ffff:/, ''), allowTestNet)) return sock.destroy();
  const f = framer(sock);
  try {
    const { mode, peer, ch } = await respond(f, {
      me,
      pskFor: () => (pairing && Date.now() < pairing.expiresAt ? pairing.psk : null),
      trusts: (pub) => trusted.has(pub.toString('hex')),
    });
    if (mode === MODE.PAIR) {
      pairing = null; // single use
      trusted.add(peer.toString('hex'));
      ch.send({ t: 'key', k: dataKey.toString('base64') });
    }
    for (;;) {
      const m = await ch.recv();
      if (m.t === 'push') {
        for (const op of m.ops) log.push({ seq: log.length + 1, op });
        ch.send({ t: 'ok', seq: log.length });
      } else if (m.t === 'pull') {
        const page = log.filter((e) => e.seq > m.since).slice(0, m.limit);
        const cursor = page.length ? page[page.length - 1].seq : m.since;
        ch.send({ t: 'page', ops: page.map((e) => e.op), cursor, more: cursor < log.length });
      } else break;
    }
  } catch {
    /* failed handshake or closed: drop silently, no logging of payloads */
  }
  sock.destroy();
});

server.listen(0, ip, async () => {
  const { port } = server.address();
  const fp = fingerprint(me.pub);
  const instance = `nemo-${crypto.randomBytes(2).toString('hex')}`;
  await announce({
    service: '_nemo-sync._tcp.local',
    instance,
    host: `${instance}.local`,
    ip,
    port,
    txt: { v: '1', fp: fp.subarray(0, 8).toString('hex') },
  });
  const qr = encodeQr({ fp, psk: pairing.psk, expiresAt: pairing.expiresAt, port, ip });
  process.stdout.write(`${JSON.stringify({ ready: true, qr })}\n`);
});
