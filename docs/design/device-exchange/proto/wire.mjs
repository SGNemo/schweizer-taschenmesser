// Device exchange prototype – shared pieces: a stand-in channel, the frame codec and the
// receiver's file-name rules. NOT product code and NOT Noise: the product reuses the LAN hub's
// `snow` session (handshake, keys, trust list, home-network rule: see sync-lan/proto, which
// already exercises that part). What this measures is the cost of the exchange layer on top:
// frames of at most 65 535 bytes (Noise's limit), ChaCha20-Poly1305 per frame, SHA-256 per file.
import crypto from "node:crypto";

export const NOISE_MAX = 65_535; // Noise spec §3: a transport message is at most 65 535 bytes
export const TAG_LEN = 16;
export const HEADER = 1 + 16 + 8; // tag | file id (16 B) | offset (u64)
export const MAX_CHUNK = NOISE_MAX - TAG_LEN - HEADER; // 65 494 bytes of file per frame

// Tags (phone → PC and PC → phone use the same set; the PC answers, never dials).
export const T = {
  MSG: 0x01, // {id, kind: 'text'|'link', body}
  ACK: 0x02, // {id}
  OFFER: 0x10, // {id, name, size, sha256}
  ACCEPT: 0x11, // {id, from} – from > 0 resumes
  REFUSE: 0x12, // {id, code}
  CHUNK: 0x13, // binary: tag | id | offset | bytes
  END: 0x14, // {id}
  RESULT: 0x15, // {id, ok, code?}
  CANCEL: 0x16, // {id}
};

/** X25519 + HKDF → two ChaCha20-Poly1305 keys; nonce = frame counter (like Noise transport). */
export function keys(mine, theirPub, initiator) {
  const pub = crypto.createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b656e032100", "hex"),
      theirPub,
    ]),
    format: "der",
    type: "spki",
  });
  const k = Buffer.from(
    crypto.hkdfSync(
      "sha256",
      crypto.diffieHellman({ privateKey: mine.privateKey, publicKey: pub }),
      Buffer.alloc(32),
      "nemo-exchange-proto",
      64,
    ),
  );
  return initiator
    ? { send: k.subarray(0, 32), recv: k.subarray(32) }
    : { send: k.subarray(32), recv: k.subarray(0, 32) };
}
export function ephemeral() {
  const kp = crypto.generateKeyPairSync("x25519");
  return {
    privateKey: kp.privateKey,
    pub: kp.publicKey.export({ format: "der", type: "spki" }).subarray(12),
  };
}

const nonce = (n) => {
  const iv = Buffer.alloc(12);
  iv.writeBigUInt64LE(BigInt(n), 4);
  return iv;
};

/** Length-prefixed (u16, like Noise over TCP) sealed frames on a socket. */
export function channel(sock, k) {
  sock.setNoDelay(true);
  let sn = 0;
  let rn = 0;
  let buf = Buffer.alloc(0);
  const ready = [];
  const waiting = [];
  let closed = null;
  sock.on("data", (d) => {
    buf = buf.length ? Buffer.concat([buf, d]) : d;
    while (buf.length >= 2) {
      const len = buf.readUInt16BE(0);
      if (buf.length < 2 + len) break;
      const sealed = buf.subarray(2, 2 + len);
      buf = buf.subarray(2 + len);
      const dc = crypto.createDecipheriv(
        "chacha20-poly1305",
        k.recv,
        nonce(rn++),
        { authTagLength: TAG_LEN },
      );
      dc.setAuthTag(sealed.subarray(sealed.length - TAG_LEN));
      const plain = Buffer.concat([
        dc.update(sealed.subarray(0, sealed.length - TAG_LEN)),
        dc.final(),
      ]);
      waiting.length ? waiting.shift().resolve(plain) : ready.push(plain);
    }
  });
  const fail = (e) => {
    closed = e ?? new Error("closed");
    while (waiting.length) waiting.shift().reject(closed);
  };
  sock.on("close", () => fail());
  sock.on("error", fail);
  return {
    /** Resolves once the socket can take more (TCP back-pressure = the transfer's flow control). */
    send(plain) {
      if (plain.length + TAG_LEN > NOISE_MAX)
        throw new Error("frame too large");
      const c = crypto.createCipheriv(
        "chacha20-poly1305",
        k.send,
        nonce(sn++),
        { authTagLength: TAG_LEN },
      );
      const sealed = Buffer.concat([
        c.update(plain),
        c.final(),
        c.getAuthTag(),
      ]);
      const h = Buffer.alloc(2);
      h.writeUInt16BE(sealed.length);
      const more = sock.write(Buffer.concat([h, sealed]));
      return more ? null : new Promise((r) => sock.once("drain", r));
    },
    recv() {
      if (ready.length) return Promise.resolve(ready.shift());
      if (closed) return Promise.reject(closed);
      return new Promise((resolve, reject) =>
        waiting.push({ resolve, reject }),
      );
    },
  };
}

export const ctl = (tag, obj) =>
  Buffer.concat([Buffer.from([tag]), Buffer.from(JSON.stringify(obj))]);
export const parse = (frame) => ({
  tag: frame[0],
  body: frame[0] === T.CHUNK ? frame : JSON.parse(frame.subarray(1).toString()),
});

// ---- Receiver's file-name rules (the PC and the phone apply them to every incoming name) ----

const RESERVED =
  /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$)$/i;
// Bidi overrides/isolates, zero-width and other format characters (Unicode category Cf), controls.
const INVISIBLE = /[\p{Cc}\p{Cf}\u2028\u2029]/gu;
// Letters that render blank (Hangul fillers, Braille blank): they could push the real extension
// off a narrow card, so they become "_" (the card also truncates in the middle, never the end).
const BLANK = /[\u115F\u1160\u3164\uFFA0\u2800]/g;
const FORBIDDEN = /[<>:"/\\|?*]/g;
const MAX_NAME_BYTES = 120;
const trimEnd = (x) => x.replace(/[\s.]+$/, "");
const DEFUSE = new Set(
  "url lnk scf library-ms searchconnector-ms search-ms desktop website appref-ms".split(
    " ",
  ),
);

/**
 * Turns a sender's name into one plain file name for the receiver's folder: no path, no control
 * or invisible characters, no Windows-reserved name, no trailing dot/space, ≤ 120 UTF-8 bytes
 * with the extension kept. Never trusts the sender; the result is joined to the chosen folder
 * only after this. Collisions get " (2)", " (3)" … (not here: needs the folder).
 */
export function cleanName(raw) {
  let s = String(raw ?? "").normalize("NFC");
  s = s.split(/[\\/]/).pop(); // last path segment only: "../../x" → "x", "C:\\x" → "x"
  s = s.replace(INVISIBLE, "").replace(BLANK, "_").replace(FORBIDDEN, "_");
  s = trimEnd(s.replace(/^[\s.]+/, "")); // no leading dots (hidden/".."), no trailing dot/space
  if (!s) s = "Datei";
  let dot = s.lastIndexOf(".");
  // an "extension" over 20 bytes is not one: it stays part of the stem, nothing is dropped
  if (dot > 0 && Buffer.byteLength(s.slice(dot)) > 20) dot = -1;
  let stem = dot > 0 ? trimEnd(s.slice(0, dot)) : s; // "con .txt": the stem is "con"
  let ext = dot > 0 ? s.slice(dot) : "";
  // Shortcut-like files make Explorer resolve an icon or target just by showing the folder (an
  // SMB path leaks the NTLM hash): they get "_" appended, so no handler ever parses them.
  if (DEFUSE.has(ext.slice(1).toLowerCase())) ext += "_";
  stem = cutBytes(stem, MAX_NAME_BYTES - Buffer.byteLength(ext)); // one pass, never quadratic
  stem = trimEnd(stem) || "Datei";
  // Windows treats "CON", "con.txt", "con .txt" and "con.tar.gz" alike: test the first segment.
  if (RESERVED.test(trimEnd(stem.split(".")[0]))) stem = `_${stem}`;
  return stem + ext;
}

/** Longest prefix of whole code points that fits into `max` UTF-8 bytes. */
function cutBytes(text, max) {
  let out = "";
  let used = 0;
  for (const ch of text) {
    used += Buffer.byteLength(ch);
    if (used > max) break;
    out += ch;
  }
  return out;
}

// Allow-list: only these get "Öffnen" (the OS default app). Everything else – programs, scripts,
// shortcuts, installers, disk images, HTML/SVG (local script), unknown types – is "other": warning
// line, only "Im Ordner zeigen". Inverted on purpose: a deny-list always misses a handler.
const OPENABLE = new Set(
  "jpg jpeg png gif webp heic heif avif bmp mp3 m4a aac ogg opus flac wav mp4 m4v mov mkv webm pdf txt md csv docx xlsx pptx odt ods odp zip".split(
    " ",
  ),
);
/** 'plain' = may be opened on a click; 'other' = never opened from Nemo. Last extension decides. */
export const risk = (name) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 && OPENABLE.has(name.slice(dot + 1).toLowerCase())
    ? "plain"
    : "other";
};

/** Part files are named from the authenticated peer and a validated 16-byte id, never sender text. */
export const partName = (peerHex, idHex) => {
  if (!/^[0-9a-f]{32}$/.test(idHex) || !/^[0-9a-f]{16,64}$/.test(peerHex))
    throw new Error("bad id");
  return `${peerHex}-${idHex}.part`;
};
