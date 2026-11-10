// Remote-control prototype, PC side (process A). Run through `run.mjs`. Not product code.
// Accepts sessions on the LAN interface with the Noise-like channel of the sync prototype, keeps a
// per-device grant (none | media | full) that only this process can set (stdin = "the PC"), and
// "applies" input by moving a virtual cursor – nothing is injected into the OS.
import net from 'node:net';
import readline from 'node:readline';
import { framer, keyPair, respond, isLanV4 } from '../../sync-lan/proto/channel.mjs';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const ip = arg('ip');
if (!isLanV4(ip, process.argv.includes('--allow-test-net'))) throw new Error('not a private address');

const me = keyPair();
const grants = new Map(); // phone static key (hex) -> 'none' | 'media' | 'full'; trust list + grant flag
const MEDIA_KINDS = new Set(['v']); // volume / media keys; everything else needs 'full'
const RATE = 500; // events per second per session (token bucket) …
const BURST = 250; // … with this burst; a touchpad needs ≤ 240/s
const store = new Map(); // stands in for the sync store (product: SQLite)
// ASSUMPTION, not a measurement: the product's store commits a push to SQLite; the connection is
// busy for that long. 0 = in-memory only.
const STORE_MS = Number(arg('storeMs') ?? 15);
const cursor = { x: 0, y: 0 };

function session(peerHex, ch) {
  const s = { lat: [], applied: 0, refused: 0, dropped: 0, frames: 0, tokens: BURST, last: process.hrtime.bigint() };
  const apply = (e) => {
    const [kind, dx, dy, ts] = e;
    const grant = grants.get(peerHex) ?? 'none'; // read per event: switching off on the PC acts at once
    if (grant === 'none' || (grant === 'media' && !MEDIA_KINDS.has(kind))) return void s.refused++;
    const now = process.hrtime.bigint();
    s.tokens = Math.min(BURST, s.tokens + (Number(now - s.last) / 1e9) * RATE);
    s.last = now;
    if (s.tokens < 1) return void s.dropped++;
    s.tokens--;
    if (kind === 'm') ((cursor.x += dx), (cursor.y += dy));
    s.applied++;
    s.lat.push(Number(now - BigInt(ts)) / 1e6); // ms; both processes share the monotonic clock
  };
  (async () => {
    for (;;) {
      const m = await ch.recv();
      if (m.t === 'in') {
        s.frames++; // one-way: no reply
        for (const e of m.e) apply(e);
      } else if (m.t === 'in1') {
        s.frames++; // lockstep variant: today's request/response shape
        apply(m.e);
        ch.send({ ok: true });
      } else if (m.t === 'sync') {
        for (const op of m.ops) store.set(`${op.collection}/${op.id}/${op.field}`, op);
        if (STORE_MS) await new Promise((r) => setTimeout(r, STORE_MS)); // this connection only, like one thread per connection
        ch.send({ ok: true, n: m.ops.length });
      } else if (m.t === 'stats') {
        ch.send({ lat: s.lat, applied: s.applied, refused: s.refused, dropped: s.dropped, frames: s.frames });
        Object.assign(s, { lat: [], applied: 0, refused: 0, dropped: 0, frames: 0, tokens: BURST });
      }
    }
  })().catch(() => {});
}

const server = net.createServer((sock) => {
  respond(framer(sock), { me, peekPsk: () => null, burn() {}, trusts: (pub) => grants.has(pub.toString('hex')) })
    .then(({ peer, ch }) => session(peer.toString('hex'), ch))
    .catch(() => sock.destroy());
});
server.listen(0, ip, () => console.log(JSON.stringify({ port: server.address().port, hubPub: me.pub.toString('hex') })));

// "The PC": only this side can pair a device and set its grant.
readline.createInterface({ input: process.stdin }).on('line', (l) => {
  const [cmd, key, grant] = l.split(' ');
  if (cmd === 'grant') grants.set(key, grant);
});
