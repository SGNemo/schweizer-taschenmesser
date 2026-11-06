// Encrypted, mutually authenticated channel for the prototype. Noise-*like* (IK shape: the phone
// knows the hub's static key from the QR; pairing mixes the QR's one-time secret into message 1,
// like IKpsk1), NOT Noise: the product uses a vetted implementation (Rust `snow`), see
// CONCEPT.md §5. The hub never sends its static key, so a stranger cannot learn it. Not product code.
import crypto from 'node:crypto';

const PROLOGUE = Buffer.from('nemo-lan-proto-v1');
const SPKI_X25519 = Buffer.from('302a300506032b656e032100', 'hex');
const ZERO = Buffer.alloc(32);

export const MODE = { PAIR: 1, SESSION: 2 };

export function keyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('x25519');
  return { privateKey, pub: publicKey.export({ format: 'der', type: 'spki' }).subarray(12) };
}
const pubKey = (raw) =>
  crypto.createPublicKey({ key: Buffer.concat([SPKI_X25519, raw]), format: 'der', type: 'spki' });
const dh = (kp, raw) => crypto.diffieHellman({ privateKey: kp.privateKey, publicKey: pubKey(raw) });
export const fingerprint = (pub) => crypto.createHash('sha256').update(pub).digest();
const hkdf = (ikm, salt, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));

function seal(key, n, plain, aad) {
  const iv = Buffer.alloc(12);
  iv.writeBigUInt64BE(BigInt(n), 4);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(aad);
  return Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]);
}
function open(key, n, sealed, aad) {
  const iv = Buffer.alloc(12);
  iv.writeBigUInt64BE(BigInt(n), 4);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAAD(aad);
  d.setAuthTag(sealed.subarray(sealed.length - 16));
  return Buffer.concat([d.update(sealed.subarray(0, sealed.length - 16)), d.final()]);
}

export const MAX_HANDSHAKE_FRAME = 256; // message 1 is 97 bytes
const MAX_FRAME = 16 * 1024 * 1024;

/**
 * Length-prefixed frames on a net.Socket; `read()` resolves with the next frame. `max` caps the
 * frame length (small during the handshake, raised after authentication).
 */
export function framer(sock, max = MAX_HANDSHAKE_FRAME) {
  sock.setNoDelay(true); // small handshake frames must not wait for Nagle
  let buf = Buffer.alloc(0);
  const waiting = [];
  const ready = [];
  let closed = null;
  sock.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 4) {
      const len = buf.readUInt32BE(0);
      if (len > self.max) {
        fail(new Error('frame too large'));
        return void sock.destroy();
      }
      if (buf.length < 4 + len) break;
      const frame = buf.subarray(4, 4 + len);
      buf = buf.subarray(4 + len);
      waiting.length ? waiting.shift().resolve(frame) : ready.push(frame);
    }
  });
  const fail = (e) => {
    closed = e ?? new Error('closed');
    while (waiting.length) waiting.shift().reject(closed);
  };
  sock.on('close', () => fail());
  sock.on('error', fail);
  const self = {
    max,
    write(b) {
      const h = Buffer.alloc(4);
      h.writeUInt32BE(b.length);
      sock.write(Buffer.concat([h, b]));
    },
    read() {
      if (ready.length) return Promise.resolve(ready.shift());
      if (closed) return Promise.reject(closed);
      return new Promise((resolve, reject) => waiting.push({ resolve, reject }));
    },
  };
  return self;
}

function transport(f, sendKey, recvKey, sas) {
  let sn = 0;
  let rn = 0;
  return {
    send(obj) {
      f.write(seal(sendKey, sn++, Buffer.from(JSON.stringify(obj)), PROLOGUE));
    },
    async recv() {
      const frame = await f.read();
      const msg = JSON.parse(open(recvKey, rn++, frame, PROLOGUE).toString());
      // Message 1 is replayable (Noise spec §7.7); only a decrypted transport frame proves the
      // peer completed this handshake. Until then frames stay at the small handshake cap.
      f.max = MAX_FRAME;
      return msg;
    },
    sas,
  };
}

/** Short authentication string shown on both screens at pairing (6 digits from the transcript). */
const sasOf = (t) => String(crypto.createHash('sha256').update(t).digest().readUInt32BE(0) % 1_000_000).padStart(6, '0');
const M1_LEN = 1 + 32 + 48 + 16;

/**
 * Initiator (phone). `hubPub` = the hub's static key (from the QR, pinned afterwards).
 * PAIR: `psk` from the QR, mixed into the message-1 payload key (IKpsk1 shape), so the hub can
 * check the current window's secret before it burns the window or shows a code. SESSION: no psk.
 * Message 1: mode | e | AEAD_es(phone static) | AEAD_es+ss(+psk)(empty).
 * After message 2 the phone sends a `hello` frame: the first proof of a live, complete handshake.
 */
export async function initiate(f, { mode, me, psk, hubPub, name = 'Pixel 7' }) {
  name = Buffer.from(name).subarray(0, 64).toString(); // fits the handshake frame cap (product: cut at a character boundary)
  const salt = mode === MODE.PAIR ? psk : ZERO;
  const e = keyPair();
  const es = dh(e, hubPub);
  const ss = dh(me, hubPub);
  const t0 = Buffer.concat([PROLOGUE, Buffer.from([mode]), e.pub, hubPub]);
  const c1 = seal(hkdf(es, ZERO, t0, 32), 0, me.pub, t0);
  const t1 = Buffer.concat([t0, c1]);
  f.write(Buffer.concat([Buffer.from([mode]), e.pub, c1, seal(hkdf(Buffer.concat([es, ss]), salt, t1, 32), 0, Buffer.alloc(0), t1)]));
  // The hub answers nothing it cannot authenticate: a dropped connection while pairing means
  // "Kopplung nicht möglich – am PC neu zeigen" (closed or stale window), otherwise "not reachable".
  const m2 = await f.read().catch(() => {
    throw new Error(mode === MODE.PAIR ? 'pairing-not-possible' : 'network');
  });
  const ea = m2.subarray(0, 32);
  const t2 = Buffer.concat([t1, ea]);
  const k2 = hkdf(Buffer.concat([es, ss, dh(e, ea), dh(me, ea)]), salt, t2, 96);
  // Decrypts only if the peer owns the hub's private key (es) and, when pairing, knows the psk.
  const status = JSON.parse(open(k2.subarray(64), 0, m2.subarray(32), t2).toString());
  if (!status.ok) throw new Error(`refused:${status.reason}`); // authenticated by the hub
  const ch = transport(f, k2.subarray(0, 32), k2.subarray(32, 64), sasOf(t2));
  ch.send({ t: 'hello', name });
  return ch;
}

/**
 * Responder (hub). `peekPsk()` returns the live window's secret without consuming it; `burn()`
 * consumes it. `trusts(pub)` decides SESSION access. Resolves after the peer's `hello` decrypted.
 */
export async function respond(f, { me, peekPsk, burn, trusts }) {
  const m1 = await f.read();
  const mode = m1[0];
  if (m1.length !== M1_LEN || (mode !== MODE.PAIR && mode !== MODE.SESSION)) throw new Error('malformed');
  const eb = m1.subarray(1, 33);
  const es = dh(me, eb);
  const t0 = Buffer.concat([PROLOGUE, Buffer.from([mode]), eb, me.pub]);
  const c1 = m1.subarray(33, 81);
  const sb = open(hkdf(es, ZERO, t0, 32), 0, c1, t0); // fails for anyone without the hub's key
  const t1 = Buffer.concat([t0, c1]);
  const ss = dh(me, sb);
  let psk = ZERO;
  if (mode === MODE.PAIR) {
    psk = peekPsk();
    if (!psk) throw new Error('no pairing window open'); // silent drop: no probing of open windows
  }
  // PAIR: fails for an old QR, a revoked device or a replay from an earlier window – nothing burned.
  open(hkdf(Buffer.concat([es, ss]), psk, t1, 32), 0, m1.subarray(81), t1);
  if (mode === MODE.PAIR) burn(); // the sender proved the current secret
  const e = keyPair();
  const t2 = Buffer.concat([t1, e.pub]);
  const k2 = hkdf(Buffer.concat([es, ss, dh(e, eb), dh(e, sb)]), psk, t2, 96);
  const ok = mode === MODE.PAIR || trusts(sb);
  const status = ok ? { ok: true } : { ok: false, reason: 'unknown-device' };
  f.write(Buffer.concat([e.pub, seal(k2.subarray(64), 0, Buffer.from(JSON.stringify(status)), t2)]));
  if (!ok) throw new Error('unknown device');
  const ch = transport(f, k2.subarray(32, 64), k2.subarray(0, 32), sasOf(t2));
  const hello = await ch.recv(); // only now: raise frame cap, record activity, show the code
  if (hello.t !== 'hello' || typeof hello.name !== 'string') throw new Error('expected hello'); // name is plain text
  return { mode, peer: sb, name: hello.name, ch };
}

/** mDNS hint that rotates daily: only devices that know the hub key can match it. */
export function dailyHint(hubPub, day = new Date().toISOString().slice(0, 10)) {
  return crypto.createHmac('sha256', fingerprint(hubPub)).update(day).digest().subarray(0, 8).toString('hex');
}
/** Yesterday, today, tomorrow (UTC) – tolerates midnight and small clock skew. */
export const hintsAround = (hubPub, now = Date.now()) =>
  [-1, 0, 1].map((d) => dailyHint(hubPub, new Date(now + d * 86_400_000).toISOString().slice(0, 10)));

// ---- E2E value encryption, same format and AAD as web/src/core/sync/crypto.ts ----
export function encryptValue(key, op, value) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(Buffer.from(`${op.collection}/${op.id}/${op.field}`));
  const ct = Buffer.concat([c.update(JSON.stringify(value)), c.final(), c.getAuthTag()]);
  return `enc:v1:${iv.toString('base64')}:${ct.toString('base64')}`;
}
export function decryptValue(key, op) {
  const [, , ivB, ctB] = op.value.split(':');
  const ct = Buffer.from(ctB, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64'));
  d.setAAD(Buffer.from(`${op.collection}/${op.id}/${op.field}`));
  d.setAuthTag(ct.subarray(ct.length - 16));
  return JSON.parse(Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]).toString());
}

// ---- QR payload: version | hub static public key (32) | one-time psk (16) | expiry (u32 s) | port (u16) | ipv4 (4) ----
export function encodeQr({ hubPub, psk, expiresAt, port, ip }) {
  const b = Buffer.alloc(1 + 32 + 16 + 4 + 2 + 4);
  b[0] = 1;
  hubPub.copy(b, 1);
  psk.copy(b, 33);
  b.writeUInt32BE(Math.floor(expiresAt / 1000), 49);
  b.writeUInt16BE(port, 53);
  Buffer.from(ip.split('.').map(Number)).copy(b, 55);
  return `NEMO1:${b.toString('base64url')}`;
}
export function decodeQr(text) {
  const b = Buffer.from(text.slice('NEMO1:'.length), 'base64url');
  if (b[0] !== 1 || b.length !== 59) throw new Error('bad qr');
  return {
    hubPub: b.subarray(1, 33),
    psk: b.subarray(33, 49),
    expiresAt: b.readUInt32BE(49) * 1000,
    port: b.readUInt16BE(53),
    ip: [...b.subarray(55, 59)].join('.'),
  };
}

/** RFC 1918 + link-local only; `allowTestNet` lets the prototype run in a container on 192.0.2.0/24. */
export function isLanV4(ip, allowTestNet = false) {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (allowTestNet && a === 192 && b === 0)
  );
}
