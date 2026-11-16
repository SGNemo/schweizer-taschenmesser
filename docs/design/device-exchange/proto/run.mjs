// Device exchange prototype – run: `node docs/design/device-exchange/proto/run.mjs` (Node ≥ 20,
// no install). Starts the PC side as its own process and plays the phone: message latency both
// ways, files of several sizes, an interrupted transfer that resumes, a corrupted resume that the
// checksum catches, and the file-name rules. Prints Markdown tables.
// Env: ROUNDS (default 5), SIZES in MB (default "1,16,64,256"), LAN_IP (default: first non-internal IPv4).
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_CHUNK,
  T,
  channel,
  cleanName,
  ctl,
  ephemeral,
  keys,
  parse,
  partName,
  risk,
} from "./wire.mjs";

const PHONE_ID = crypto.randomBytes(8);
const here = path.dirname(fileURLToPath(import.meta.url));
const ROUNDS = Number(process.env.ROUNDS ?? 5);
const SIZES = (process.env.SIZES ?? "1,16,64,256").split(",").map(Number);
const ip =
  process.env.LAN_IP ??
  Object.values(os.networkInterfaces())
    .flat()
    .find((i) => i.family === "IPv4" && !i.internal)?.address;
const work = fs.mkdtempSync(path.join(os.tmpdir(), "nemo-exchange-"));
const inbox = path.join(work, "inbox");
fs.mkdirSync(inbox);

const pc = spawn(
  process.execPath,
  [path.join(here, "pc.mjs"), `--ip=${ip}`, `--dir=${inbox}`],
  { stdio: ["ignore", "pipe", "inherit"] },
);
const port = await new Promise((r) =>
  pc.stdout.once("data", (d) => r(JSON.parse(d).port)),
);

async function connect() {
  const sock = net.connect(port, ip);
  await new Promise((r) => sock.once("connect", r));
  const me = ephemeral();
  sock.write(Buffer.concat([me.pub, PHONE_ID])); // ephemeral key + stand-in device id
  const theirs = await new Promise((r) => sock.once("data", r));
  const ch = channel(sock, keys(me, theirs.subarray(0, 32), true));
  if (theirs.length > 32) sock.emit("data", theirs.subarray(32));
  return { sock, ch };
}
const expect = async (ch, tag) => {
  const m = parse(await ch.recv());
  if (m.tag !== tag)
    throw new Error(`expected ${tag}, got ${m.tag} ${JSON.stringify(m.body)}`);
  return m.body;
};

/** Sends a file; `stopAt` (bytes) drops the connection there to simulate leaving the Wi-Fi. */
async function sendFile(
  file,
  {
    id = crypto.randomBytes(16).toString("hex"),
    name,
    stopAt = Infinity,
    chunk = MAX_CHUNK,
    sha,
  } = {},
) {
  const { sock, ch } = await connect();
  const size = fs.statSync(file).size;
  sha ??= crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
  const t0 = performance.now();
  await ch.send(ctl(T.OFFER, { id, name, size, sha256: sha }));
  const { from } = await expect(ch, T.ACCEPT);
  const fd = fs.openSync(file, "r");
  const idb = Buffer.from(id, "hex");
  const buf = Buffer.alloc(chunk);
  for (let off = from; off < size; ) {
    if (off >= stopAt) {
      fs.closeSync(fd);
      sock.destroy();
      await new Promise((r) => setTimeout(r, 50));
      return { id, sha, interrupted: off };
    }
    const n = fs.readSync(fd, buf, 0, Math.min(chunk, size - off), off);
    const head = Buffer.alloc(25);
    head[0] = T.CHUNK;
    idb.copy(head, 1);
    head.writeBigUInt64BE(BigInt(off), 17);
    const wait = ch.send(Buffer.concat([head, buf.subarray(0, n)]));
    if (wait) await wait;
    off += n;
  }
  fs.closeSync(fd);
  await ch.send(ctl(T.END, { id }));
  const res = await expect(ch, T.RESULT);
  const ms = performance.now() - t0;
  sock.destroy();
  return { ...res, ms, from, size };
}

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const p95 = (a) =>
  [...a].sort((x, y) => x - y)[
    Math.min(a.length - 1, Math.floor(a.length * 0.95))
  ];
const out = [];

// 1. Message latency: phone → PC → ACK (round trip), and PC → phone on the open session.
{
  const { sock, ch } = await connect();
  const rtt = [];
  const back = [];
  for (let i = 0; i < 200 * ROUNDS; i++) {
    const t0 = performance.now();
    await ch.send(
      ctl(T.MSG, {
        id: `m${i}`,
        kind: "text",
        body: i % 20 ? "Vergiss nicht, Milch zu kaufen" : "ping-back",
      }),
    );
    await expect(ch, T.ACK);
    rtt.push(performance.now() - t0);
    if (!(i % 20)) {
      await expect(ch, T.MSG);
      back.push(performance.now() - t0);
    }
  }
  sock.destroy();
  const t0 = performance.now();
  const c2 = await connect();
  await c2.ch.send(
    ctl(T.MSG, { id: "cold", kind: "link", body: "https://example.org/" }),
  );
  await expect(c2.ch, T.ACK);
  const cold = performance.now() - t0;
  c2.sock.destroy();
  out.push("| Measure | median | p95 | n |", "|---|---|---|---|");
  out.push(
    `| Text message phone → PC, sent → ACK back (open session) | ${median(rtt).toFixed(2)} ms | ${p95(rtt).toFixed(2)} ms | ${rtt.length} |`,
  );
  out.push(
    `| Message PC → phone after a phone frame (open session) | ${median(back).toFixed(2)} ms | ${p95(back).toFixed(2)} ms | ${back.length} |`,
  );
  out.push(
    `| Message on a new connection (connect + key exchange + send + ACK) | ${cold.toFixed(2)} ms | – | 1 |`,
    "",
  );
}

// 2. Throughput per size.
out.push(
  "| File | chunk | median MB/s | min | max | SHA-256 at the PC (median) | rounds |",
  "|---|---|---|---|---|---|---|",
);
for (const mb of SIZES) {
  const file = path.join(work, `f${mb}.bin`);
  const fh = fs.openSync(file, "w");
  for (let i = 0; i < mb; i++)
    fs.writeSync(fh, crypto.randomBytes(1024 * 1024));
  fs.closeSync(fh);
  for (const chunk of mb === SIZES.at(-1)
    ? [16 * 1024, MAX_CHUNK]
    : [MAX_CHUNK]) {
    const rates = [];
    const hashes = [];
    for (let r = 0; r < ROUNDS; r++) {
      const res = await sendFile(file, { name: `Foto ${mb}.jpg`, chunk });
      if (!res.ok) throw new Error("checksum failed");
      rates.push(mb / (res.ms / 1000));
      hashes.push(res.hashMs);
      fs.rmSync(path.join(inbox, res.saved));
    }
    out.push(
      `| ${mb} MB | ${chunk === MAX_CHUNK ? `${MAX_CHUNK} B (max)` : "16 KiB"} | ${median(rates).toFixed(0)} | ${Math.min(...rates).toFixed(0)} | ${Math.max(...rates).toFixed(0)} | ${median(hashes).toFixed(1)} ms | ${ROUNDS} |`,
    );
  }
}
out.push("");

// 3. Interrupt, resume, corrupt.
const big = path.join(work, `f${SIZES.at(-1)}.bin`);
const size = fs.statSync(big).size;
const cut = await sendFile(big, {
  name: "Backup.zip",
  stopAt: Math.floor(size * 0.4),
});
const resumed = await sendFile(big, {
  id: cut.id,
  sha: cut.sha,
  name: "Backup.zip",
});
const cut2 = await sendFile(big, {
  name: "Backup.zip",
  stopAt: Math.floor(size * 0.4),
});
const part = fs
  .readdirSync(inbox)
  .map((n) => path.join(inbox, n))
  .find((n) => n.endsWith(`${cut2.id}.part`));
const fd = fs.openSync(part, "r+");
fs.writeSync(fd, Buffer.from([0xff ^ fs.readFileSync(part)[1000]]), 0, 1, 1000); // one flipped byte on disk
fs.closeSync(fd);
const corrupt = await sendFile(big, {
  id: cut2.id,
  sha: cut2.sha,
  name: "Backup.zip",
});
const checks = {
  resumeFromPart: resumed.from === cut.interrupted && resumed.from > 0,
  resumeChecksumOk: resumed.ok === true,
  corruptionCaught: corrupt.ok === false && !fs.existsSync(part),
};

// 4. File names.
const names = [
  ["../../Windows/System32/evil.dll", "evil.dll"],
  ["C:\\Users\\x\\Desktop\\a.txt", "a.txt"],
  ["CON.txt", "_CON.txt"],
  ["com1", "_com1"],
  ["Rechnung\u202Efdp.exe", "Rechnungfdp.exe"],
  ["  .versteckt", "versteckt"],
  ["Notiz. . .", "Notiz"],
  ['a<b>c:d"e|f?g*h.png', "a_b_c_d_e_f_g_h.png"],
  ["zero\u200Bwidth.pdf", "zerowidth.pdf"],
  ["", "Datei"],
  ["..", "Datei"],
  ["x".repeat(300) + ".jpeg", "x".repeat(115) + ".jpeg"],
  ["e\u0301te\u0301.txt", "été.txt"],
  ["con .txt", "_con.txt"],
  ["CON  .txt", "_CON.txt"],
  ["nul.tar.gz", "_nul.tar.gz"],
  ["Rechnung\u3164\u3164.pdf.exe", "Rechnung__.pdf.exe"],
  ["x.pdf." + "a".repeat(26), "x.pdf." + "a".repeat(26)],
  ["Ordner.url", "Ordner.url_"],
  ["Start.LNK", "Start.LNK_"],
  ["Suche.searchConnector-ms", "Suche.searchConnector-ms_"],
  ["y".repeat(30000) + ".txt", "y".repeat(116) + ".txt"],
  ["a".repeat(115) + ".lnk." + "b".repeat(25), "a".repeat(115) + ".lnk_"],
  ["a".repeat(115) + ".url." + "b".repeat(25), "a".repeat(115) + ".url_"],
  ["a".repeat(116) + ".scf" + "b".repeat(30), "a".repeat(116) + ".sc"],
  ["Design.themepack", "Design.themepack_"],
  ["con." + "c".repeat(116) + ".txt", "_con." + "c".repeat(111) + ".txt"],
];
const nameFails = names
  .filter(([i, o]) => cleanName(i) !== o)
  .map(
    ([i, o]) =>
      `${JSON.stringify(i)} → ${JSON.stringify(cleanName(i))} (want ${JSON.stringify(o)})`,
  );
const risks = {
  "Rechnung.pdf.exe": "other",
  "setup.MSI": "other",
  "Link.lnk": "other",
  "app.apk": "other",
  "x.msc": "other",
  "hilfe.chm": "other",
  "seite.html": "other",
  "bild.svg": "other",
  "a.appref-ms": "other",
  exe: "other",
  "Foto.JPG": "plain",
  "Liste.pdf": "plain",
  "Archiv.7z": "other",
  "Archiv.zip": "other",
};
const riskFails = Object.entries(risks)
  .filter(([n, r]) => risk(n) !== r)
  .map(([n]) => n);
let partIdChecked = false;
try {
  partName("ab".repeat(8), "../../x");
} catch {
  partIdChecked = true;
}
Object.assign(checks, {
  fileNames: nameFails.length === 0,
  openAllowList: riskFails.length === 0,
  partIdChecked,
});
const one = await sendFile(path.join(work, `f${SIZES[0]}.bin`), {
  name: "../Foto.jpg",
});
const two = await sendFile(path.join(work, `f${SIZES[0]}.bin`), {
  name: "Foto.jpg",
});
Object.assign(checks, {
  uniqueName: one.saved === "Foto.jpg" && two.saved === "Foto (2).jpg",
});

out.push(
  `Checks: ${Object.entries(checks)
    .map(([k, v]) => `\`${k}\` ${v ? "ok" : "FAILED"}`)
    .join(", ")}.`,
);
if (nameFails.length) out.push(...nameFails);
if (riskFails.length) out.push(`risk: ${riskFails.join(", ")}`);
out.push(`Node ${process.version}, ${os.cpus()[0].model}, interface ${ip}.`);
console.log(out.join("\n"));
pc.kill();
fs.rmSync(work, { recursive: true, force: true });
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
