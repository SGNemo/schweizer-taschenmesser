/**
 * A share file as a run of small QR codes ("Bilder"): the text is cut into frames that a phone
 * camera can read one after the other, in any order, with repeats. Nothing here is secret-aware:
 * the file is already sealed by the pairing code (`share.ts`), the frames only carry its text.
 *
 * Frame = `NSH1.<session>.<index>.<total>.<chunk>` (index from 1; chunk = base64url of the UTF-8
 * text, sliced). A frame of another session restarts the collection. The file's own checksum and
 * the AEAD tag catch a wrongly stitched or damaged result when it is opened.
 */
import { randomBytes } from '@/core/crypto/random';

const PREFIX = 'NSH1';
/** Characters of payload per frame: small enough for a calm, reliable scan with error correction M. */
export const FRAME_CHARS = 400;
/** Beyond this many frames a file is the easier way; the screen says so, it does not forbid it. */
export const MANY_FRAMES = 150;
const MAX_FRAMES = 4000;

const toBase64Url = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (b64: string): string => {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
};

/** Six hex characters from the platform CSPRNG: a foreign stream is told apart, not guessed. */
export const newSession = (): string =>
  Array.from(randomBytes(3), (b) => b.toString(16).padStart(2, '0')).join('');

export function splitIntoFrames(
  text: string,
  session: string = newSession(),
  size: number = FRAME_CHARS,
): string[] {
  const data = toBase64Url(text);
  const total = Math.max(1, Math.ceil(data.length / size));
  if (total > MAX_FRAMES) throw new RangeError('too many frames');
  return Array.from({ length: total }, (_, i) =>
    [PREFIX, session, i + 1, total, data.slice(i * size, (i + 1) * size)].join('.'),
  );
}

interface Parsed {
  session: string;
  index: number;
  total: number;
  chunk: string;
}

export function parseFrame(raw: string): Parsed | undefined {
  const m = /^NSH1\.([a-z0-9]{6})\.(\d{1,4})\.(\d{1,4})\.([A-Za-z0-9_-]*)$/.exec(raw.trim());
  if (!m) return undefined;
  const index = Number(m[2]);
  const total = Number(m[3]);
  if (index < 1 || total < 1 || index > total || total > MAX_FRAMES) return undefined;
  return { session: m[1]!, index, total, chunk: m[4]! };
}

export type CollectResult =
  | { state: 'ignored' }
  | { state: 'collecting'; have: number; total: number }
  | { state: 'done'; text: string }
  | { state: 'broken' };

/** Gathers frames until all are there. Order, repeats and a restart from a new session are fine. */
export function createFrameCollector() {
  let session: string | undefined;
  let total = 0;
  let chunks = new Map<number, string>();
  return {
    add(raw: string): CollectResult {
      const frame = parseFrame(raw);
      if (!frame) return { state: 'ignored' };
      if (frame.session !== session || frame.total !== total) {
        session = frame.session;
        total = frame.total;
        chunks = new Map();
      }
      chunks.set(frame.index, frame.chunk);
      if (chunks.size < total) return { state: 'collecting', have: chunks.size, total };
      try {
        const data = Array.from({ length: total }, (_, i) => chunks.get(i + 1) ?? '').join('');
        return { state: 'done', text: fromBase64Url(data) };
      } catch {
        return { state: 'broken' };
      }
    },
    reset(): void {
      session = undefined;
      total = 0;
      chunks = new Map();
    },
  };
}
