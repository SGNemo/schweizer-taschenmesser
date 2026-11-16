// PC side of the prototype (listener, like the hub). Receives messages and files into `--dir`,
// writes `<peer>-<hex id>.part`, resumes from its length, checks SHA-256 over the whole file, then renames
// to a cleaned, unique name. Answers with ACK/ACCEPT/RESULT and sends one message unasked
// (PC → phone travels only on a session the phone opened: the phone never listens).
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import {
  T,
  channel,
  cleanName,
  ctl,
  ephemeral,
  keys,
  parse,
  partName,
} from "./wire.mjs";

const arg = (k) =>
  process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const ip = arg("ip");
const dir = arg("dir");
const LIMIT = 4 * 1024 ** 3; // product: free space minus a reserve, and a per-file cap

/** Moves the checked part to a free name without ever replacing a file (link + unlink, no overwrite). */
function placeUnique(part, name) {
  const dot = name.lastIndexOf(".");
  const [stem, ext] =
    dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  for (let n = 1; ; n++) {
    const p = path.join(dir, n === 1 ? name : `${stem} (${n})${ext}`);
    try {
      fs.linkSync(part, p); // fails with EEXIST instead of overwriting
      fs.unlinkSync(part);
      return p;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
}

const server = net.createServer((sock) => {
  const me = ephemeral();
  let ch = null;
  let peer = null; // product: the peer's static key from the Noise handshake
  const files = new Map(); // id → {fd, size, sha, name, got}
  sock.once("data", async (first) => {
    sock.write(me.pub);
    // stand-in for the peer's static key that Noise authenticates: 8 bytes after the ephemeral key
    peer = first.subarray(32, 40).toString("hex");
    ch = channel(sock, keys(me, first.subarray(0, 32), false));
    if (first.length > 40) sock.emit("data", first.subarray(40));
    try {
      for (;;) {
        const { tag, body } = parse(await ch.recv());
        if (tag === T.MSG) {
          await ch.send(ctl(T.ACK, { id: body.id }));
          if (body.body === "ping-back")
            await ch.send(
              ctl(T.MSG, { id: "pc-1", kind: "text", body: "vom PC" }),
            );
        } else if (tag === T.OFFER) {
          if (body.size > LIMIT) {
            await ch.send(ctl(T.REFUSE, { id: body.id, code: "too-large" }));
            continue;
          }
          const part = path.join(dir, partName(peer, String(body.id))); // throws on a bad id: session closes
          const from = fs.existsSync(part) ? fs.statSync(part).size : 0;
          files.set(body.id, {
            fd: fs.openSync(part, "a"),
            part,
            ...body,
            got: from,
          });
          await ch.send(ctl(T.ACCEPT, { id: body.id, from }));
        } else if (tag === T.CHUNK) {
          const id = body.subarray(1, 17).toString("hex");
          const off = Number(body.readBigUInt64BE(17));
          const f = files.get(id);
          if (!f || off !== f.got) throw new Error("out of order"); // product: close the session
          const data = body.subarray(25);
          fs.writeSync(f.fd, data);
          f.got += data.length;
        } else if (tag === T.END) {
          const f = files.get(body.id);
          fs.closeSync(f.fd);
          const t0 = performance.now();
          const sha = crypto
            .createHash("sha256")
            .update(fs.readFileSync(f.part))
            .digest("hex");
          const hashMs = performance.now() - t0;
          const ok = sha === f.sha256 && f.got === f.size;
          let saved = null;
          if (ok) saved = placeUnique(f.part, cleanName(f.name));
          else fs.rmSync(f.part); // product: say so, offer "Nochmal senden"
          files.delete(body.id);
          await ch.send(
            ctl(T.RESULT, {
              id: body.id,
              ok,
              hashMs,
              saved: saved && path.basename(saved),
            }),
          );
        } else if (tag === T.CANCEL) {
          const f = files.get(body.id);
          if (f) (fs.closeSync(f.fd), fs.rmSync(f.part), files.delete(body.id));
        }
      }
    } catch {
      for (const f of files.values()) fs.closeSync(f.fd); // .part stays for a resume
    }
  });
});
server.listen(0, ip, () =>
  console.log(JSON.stringify({ port: server.address().port })),
);
