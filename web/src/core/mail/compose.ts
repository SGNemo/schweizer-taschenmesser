/**
 * Builds the wire format (RFC 822 / MIME) of a mail the user wrote: UTF-8 headers as encoded-words,
 * a base64 plain-text body, attachments as base64 parts. Pure; throws instead of sending anything odd.
 * Header values never carry line breaks (header injection): a CR, LF or NUL in a subject or address is refused.
 */
import { formatAddress } from './address';
import { isEmail } from './address';
import type { MailAddress, OutgoingMail } from './types';

export class ComposeError extends Error {
  constructor(readonly code: 'no-recipient' | 'bad-address' | 'bad-header' | 'too-large') {
    super(code);
  }
}

/** Gmail refuses messages over 25 MB; base64 adds a third, so stay clearly below. */
export const MAX_MAIL_BYTES = 18 * 1024 * 1024;

const enc = new TextEncoder();
const b64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const wrap76 = (s: string): string => s.replace(/(.{76})/g, '$1\r\n');

export const base64Url = (bytes: Uint8Array): string =>
  b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function headerValue(value: string): string {
  if (/[\r\n\0]/.test(value)) throw new ComposeError('bad-header');
  return value;
}

/** RFC 2047 encoded-words (UTF-8, base64), split at character boundaries; ASCII stays as it is. */
export function encodeWords(value: string): string {
  headerValue(value);
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  const words: string[] = [];
  let current = '';
  for (const ch of value) {
    if (enc.encode(current + ch).length > 42) {
      words.push(current);
      current = '';
    }
    current += ch;
  }
  if (current) words.push(current);
  return words.map((w) => `=?UTF-8?B?${b64(enc.encode(w))}?=`).join(' ');
}

function address(a: MailAddress): string {
  if (!isEmail(a.email)) throw new ComposeError('bad-address');
  headerValue(a.email);
  if (!a.name?.trim()) return a.email.trim();
  const name = headerValue(a.name.trim());
  return /^[\x20-\x7e]*$/.test(name)
    ? `"${name.replace(/(["\\])/g, '\\$1')}" <${a.email.trim()}>`
    : `${encodeWords(name)} <${a.email.trim()}>`;
}

const list = (items: MailAddress[]): string => items.map(address).join(', ');

function filenameParams(name: string): string {
  headerValue(name);
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const star = [...enc.encode(name)]
    .map((b) =>
      /[A-Za-z0-9._-]/.test(String.fromCharCode(b))
        ? String.fromCharCode(b)
        : `%${b.toString(16).toUpperCase().padStart(2, '0')}`,
    )
    .join('');
  return `filename="${ascii}"; filename*=UTF-8''${star}`;
}

function boundary(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `nemo-${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** The message as RFC 822 text with CRLF line ends (`From`, `Date` and `Message-ID` are set by the service). */
export function buildMime(mail: OutgoingMail, opts: { boundary?: string } = {}): string {
  if (mail.to.length + mail.cc.length + mail.bcc.length === 0)
    throw new ComposeError('no-recipient');
  const size = mail.text.length + mail.attachments.reduce((n, a) => n + a.data.length, 0);
  if (size > MAX_MAIL_BYTES) throw new ComposeError('too-large');

  const head: string[] = [];
  if (mail.to.length) head.push(`To: ${list(mail.to)}`);
  if (mail.cc.length) head.push(`Cc: ${list(mail.cc)}`);
  if (mail.bcc.length) head.push(`Bcc: ${list(mail.bcc)}`);
  head.push(`Subject: ${encodeWords(mail.subject)}`);
  if (mail.inReplyTo) {
    head.push(`In-Reply-To: ${headerValue(mail.inReplyTo.messageId)}`);
    head.push(`References: ${headerValue(mail.inReplyTo.references)}`);
  }
  head.push('MIME-Version: 1.0');

  const text = wrap76(b64(enc.encode(mail.text.replace(/\r?\n/g, '\r\n'))));
  const textPart = `Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${text}`;
  if (mail.attachments.length === 0) return `${head.join('\r\n')}\r\n${textPart}\r\n`;

  const b = opts.boundary ?? boundary();
  const parts = mail.attachments.map(
    (a) =>
      `--${b}\r\nContent-Type: ${headerValue(a.mime || 'application/octet-stream')}\r\n` +
      `Content-Disposition: attachment; ${filenameParams(a.filename)}\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(a.data))}`,
  );
  return (
    `${head.join('\r\n')}\r\nContent-Type: multipart/mixed; boundary="${b}"\r\n\r\n` +
    `--${b}\r\n${textPart}\r\n${parts.join('\r\n')}\r\n--${b}--\r\n`
  );
}

/** What goes into the `raw` field of Gmail's send and draft calls. */
export const buildRaw = (mail: OutgoingMail, opts?: { boundary?: string }): string =>
  base64Url(enc.encode(buildMime(mail, opts)));

export { formatAddress };
