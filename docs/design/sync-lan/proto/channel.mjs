// Encrypted, mutually authenticated channel for the prototype. Noise-*like* (XX pattern with an
// optional pre-shared key from the QR code), NOT Noise: the product would use a vetted
// implementation (Rust `snow`), see CONCEPT.md §5. Not product code.
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

/** Hub answers with a single-byte frame when it refuses; the phone can tell this from a crash. */
export const REFUSED = { 1: 'no-pairing-window', 2: 'unknown-device' };
export const MAX_HANDSHAKE_FRAME = 256;
const MAX_FRAME = 16 * 1024 * 1024;
const refusal = (frame) => (frame.length === 1 ? new Error(`refused:${REFUSED[frame[0]] ?? 'unknown'}`) : null);

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
  f.max = MAX_FRAME;
  let sn = 0;
  let rn = 0;
  return {
    send(obj) {
      f.write(seal(sendKey, sn++, Buffer.from(JSON.stringify(obj)), PROLOGUE));
    },
    async recv() {
      const frame = await f.read();
      const refused = refusal(frame);
      if (refused) throw refused;
      return JSON.parse(open(recvKey, rn++, frame, PROLOGUE).toString());
    },
    sas,
  };
}

/**
 * Initiator (phone). PAIR: `psk` and `expectFp` come from the QR code. SESSION: `expectFp` is the
 * pinned fingerprint of the hub's static key stored at pairing time; no psk.
 */
export async function initiate(f, { mode, me, psk, expectFp }) {
  const e = keyPair();
  f.write(Buffer.concat([Buffer.from([mode]), e.pub]));
  const m2 = await f.read();
  const refused = refusal(m2);
  if (refused) throw refused;
  const ea = m2.subarray(0, 32);
  const sa = m2.subarray(32, 64);
  if (!fingerprint(sa).equals(expectFp)) throw new Error('hub key does not match the pinned fingerprint');
  const salt = mode === MODE.PAIR ? psk : ZERO;
  const t1 = Buffer.concat([PROLOGUE, Buffer.from([mode]), e.pub, ea, sa]);
  const k1 = hkdf(Buffer.concat([dh(e, ea), dh(e, sa)]), salt, t1, 32);
  open(k1, 0, m2.subarray(64), t1); // proves: hub owns `sa` and (PAIR) knows the psk
  f.write(seal(k1, 1, me.pub, t1));
  const keys = hkdf(Buffer.concat([dh(e, ea), dh(e, sa), dh(me, ea)]), salt, Buffer.concat([t1, me.pub]), 64);
  return transport(f, keys.subarray(0, 32), keys.subarray(32), sasOf(t1, me.pub));
}

/** Responder (hub). `trusts(pub)` decides SESSION access; PAIR needs the live one-time psk. */
export async function respond(f, { me, pskFor, trusts }) {
  const m1 = await f.read();
  const mode = m1[0];
  const eb = m1.subarray(1, 33);
  const psk = mode === MODE.PAIR ? pskFor() : ZERO; // pskFor() burns the window at message 1
  if (!psk) {
    f.write(Buffer.from([1]));
    throw new Error('no pairing window open');
  }
  const e = keyPair();
  const t1 = Buffer.concat([PROLOGUE, Buffer.from([mode]), eb, e.pub, me.pub]);
  const k1 = hkdf(Buffer.concat([dh(e, eb), dh(me, eb)]), psk, t1, 32);
  f.write(Buffer.concat([e.pub, me.pub, seal(k1, 0, Buffer.from('hub'), t1)]));
  const sb = open(k1, 1, await f.read(), t1); // fails on a wrong psk
  if (mode === MODE.SESSION && !trusts(sb)) {
    f.write(Buffer.from([2]));
    throw new Error('unknown device');
  }
  const keys = hkdf(Buffer.concat([dh(e, eb), dh(me, eb), dh(e, sb)]), psk, Buffer.concat([t1, sb]), 64);
  return { mode, peer: sb, ch: transport(f, keys.subarray(32), keys.subarray(0, 32), sasOf(t1, sb)) };
}

/** Short authentication string shown on both screens at pairing (6 digits from the transcript). */
function sasOf(t1, phoneStatic) {
  const h = crypto.createHash('sha256').update(t1).update(phoneStatic).digest();
  return String(h.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

/** mDNS hint that rotates daily: only devices that know the fingerprint can match it. */
export function dailyHint(fp, day = new Date().toISOString().slice(0, 10)) {
  return crypto.createHmac('sha256', fp).update(day).digest().subarray(0, 8).toString('hex');
}

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

// ---- QR payload: version | hub fingerprint (32) | one-time psk (16) | expiry (u32 s) | port (u16) | ipv4 (4) ----
export function encodeQr({ fp, psk, expiresAt, port, ip }) {
  const b = Buffer.alloc(1 + 32 + 16 + 4 + 2 + 4);
  b[0] = 1;
  fp.copy(b, 1);
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
    fp: b.subarray(1, 33),
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
