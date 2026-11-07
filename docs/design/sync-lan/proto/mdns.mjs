// Minimal mDNS / DNS-SD (RFC 6762/6763) for the LAN sync prototype – no dependencies.
// Only what the prototype needs: PTR/SRV/TXT/A answers and a PTR query. Not product code.
import dgram from 'node:dgram';

export const MDNS_ADDR = '224.0.0.251';
export const MDNS_PORT = 5353;
const T = { A: 1, PTR: 12, TXT: 16, SRV: 33 };

function encodeName(name) {
  const parts = name.replace(/\.$/, '').split('.');
  const bufs = parts.map((p) => {
    const b = Buffer.from(p, 'utf8');
    return Buffer.concat([Buffer.from([b.length]), b]);
  });
  return Buffer.concat([...bufs, Buffer.from([0])]);
}

function decodeName(buf, off) {
  const labels = [];
  let jumped = false;
  let next = off;
  for (let guard = 0; guard < 64; guard++) {
    const len = buf[off];
    if (len === 0) {
      if (!jumped) next = off + 1;
      break;
    }
    if ((len & 0xc0) === 0xc0) {
      if (!jumped) next = off + 2;
      off = ((len & 0x3f) << 8) | buf[off + 1];
      jumped = true;
      continue;
    }
    labels.push(buf.toString('utf8', off + 1, off + 1 + len));
    off += 1 + len;
  }
  return [labels.join('.'), next];
}

function rr(name, type, ttl, rdata, cacheFlush = false) {
  const head = Buffer.alloc(10);
  head.writeUInt16BE(type, 0);
  head.writeUInt16BE(cacheFlush ? 0x8001 : 0x0001, 2);
  head.writeUInt32BE(ttl, 4);
  head.writeUInt16BE(rdata.length, 8);
  return Buffer.concat([encodeName(name), head, rdata]);
}

function header(id, flags, qd, an) {
  const h = Buffer.alloc(12);
  h.writeUInt16BE(id, 0);
  h.writeUInt16BE(flags, 2);
  h.writeUInt16BE(qd, 4);
  h.writeUInt16BE(an, 6);
  return h;
}

export function buildQuery(service) {
  const q = Buffer.concat([encodeName(service), Buffer.from([0, T.PTR, 0, 1])]);
  return Buffer.concat([header(0, 0, 1, 0), q]);
}

export function buildAnswer({ service, instance, host, ip, port, txt }) {
  const full = `${instance}.${service}`;
  const srv = Buffer.alloc(6);
  srv.writeUInt16BE(0, 0);
  srv.writeUInt16BE(0, 2);
  srv.writeUInt16BE(port, 4);
  const txtData = Buffer.concat(
    Object.entries(txt).map(([k, v]) => {
      const s = Buffer.from(`${k}=${v}`, 'utf8');
      return Buffer.concat([Buffer.from([s.length]), s]);
    }),
  );
  const answers = [
    rr(service, T.PTR, 120, encodeName(full)),
    rr(full, T.SRV, 120, Buffer.concat([srv, encodeName(host)]), true),
    rr(full, T.TXT, 120, txtData, true),
    rr(host, T.A, 120, Buffer.from(ip.split('.').map(Number)), true),
  ];
  return Buffer.concat([header(0, 0x8400, 0, answers.length), ...answers]);
}

export function parse(buf) {
  const qd = buf.readUInt16BE(4);
  const an = buf.readUInt16BE(6) + buf.readUInt16BE(8) + buf.readUInt16BE(10);
  const flags = buf.readUInt16BE(2);
  let off = 12;
  const questions = [];
  for (let i = 0; i < qd; i++) {
    const [name, o] = decodeName(buf, off);
    questions.push({ name, type: buf.readUInt16BE(o) });
    off = o + 4;
  }
  const answers = [];
  for (let i = 0; i < an; i++) {
    const [name, o] = decodeName(buf, off);
    const type = buf.readUInt16BE(o);
    const len = buf.readUInt16BE(o + 8);
    const d = o + 10;
    let data;
    if (type === T.PTR) data = decodeName(buf, d)[0];
    else if (type === T.SRV) data = { port: buf.readUInt16BE(d + 4), target: decodeName(buf, d + 6)[0] };
    else if (type === T.A) data = [...buf.subarray(d, d + 4)].join('.');
    else if (type === T.TXT) {
      data = {};
      for (let p = d; p < d + len; ) {
        const l = buf[p];
        const [k, ...v] = buf.toString('utf8', p + 1, p + 1 + l).split('=');
        data[k] = v.join('=');
        p += 1 + l;
      }
    }
    answers.push({ name, type, data });
    off = d + len;
  }
  return { response: (flags & 0x8000) !== 0, questions, answers };
}

function socket(iface) {
  const s = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  return new Promise((resolve) => {
    s.bind(MDNS_PORT, () => {
      s.addMembership(MDNS_ADDR, iface);
      s.setMulticastInterface(iface);
      s.setMulticastLoopback(true);
      s.setMulticastTTL(255);
      resolve(s);
    });
  });
}

/** Answers PTR queries for `service` and announces once at start. */
export async function announce(rec) {
  const s = await socket(rec.ip);
  const answer = buildAnswer(rec);
  s.on('message', (msg) => {
    try {
      const p = parse(msg);
      if (!p.response && p.questions.some((q) => q.name === rec.service && q.type === T.PTR))
        s.send(answer, MDNS_PORT, MDNS_ADDR);
    } catch {
      /* ignore malformed packets */
    }
  });
  s.send(answer, MDNS_PORT, MDNS_ADDR);
  return () => s.close();
}

/** Queries until an instance whose TXT matches `want` answers; re-queries every `everyMs`. */
export async function browse({ service, iface, want = () => true, timeoutMs = 5000, everyMs = 250 }) {
  const s = await socket(iface);
  const query = buildQuery(service);
  return new Promise((resolve, reject) => {
    const tick = setInterval(() => s.send(query, MDNS_PORT, MDNS_ADDR), everyMs);
    const stop = setTimeout(() => done(new Error('mdns: nothing found')), timeoutMs);
    function done(err, value) {
      clearInterval(tick);
      clearTimeout(stop);
      s.close();
      err ? reject(err) : resolve(value);
    }
    s.on('message', (msg, from) => {
      let p;
      try {
        p = parse(msg);
      } catch {
        return;
      }
      if (!p.response) return;
      const ptr = p.answers.find((a) => a.type === T.PTR && a.name === service);
      if (!ptr) return;
      const srv = p.answers.find((a) => a.type === T.SRV && a.name === ptr.data);
      const txt = p.answers.find((a) => a.type === T.TXT && a.name === ptr.data);
      const a = srv && p.answers.find((x) => x.type === T.A && x.name === srv.data.target);
      if (!srv || !txt || !a) return;
      const found = { instance: ptr.data, ip: a.data, port: srv.data.port, txt: txt.data, from: from.address };
      if (want(found)) done(undefined, found);
    });
    s.send(query, MDNS_PORT, MDNS_ADDR);
  });
}
