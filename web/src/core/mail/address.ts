import type { MailAddress } from './types';

/** `"Name" <a@b>`, `Name <a@b>` or a bare address. */
export function parseAddress(raw: string): MailAddress {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(raw);
  if (m) return { name: m[1]!.trim() || undefined, email: m[2]!.trim() };
  return { email: raw.trim() };
}

/** Splits a header list on commas that are not inside quotes or angle brackets. */
export function parseAddressList(raw: string): MailAddress[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = '';
  for (const ch of raw) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === '<') depth += 1;
    else if (!quoted && ch === '>') depth = Math.max(0, depth - 1);
    if (ch === ',' && !quoted && depth === 0) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  parts.push(current);
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map(parseAddress);
}

const SIMPLE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

/** A plausible address (one `@`, a dot in the domain, no spaces, quotes or separators). */
export const isEmail = (email: string): boolean => SIMPLE.test(email.trim());

/** What the user typed in a "To" field: addresses separated by comma or semicolon. */
export function parseRecipients(input: string): { valid: MailAddress[]; invalid: string[] } {
  const parts = parseAddressList(input.replace(/;/g, ','));
  const valid: MailAddress[] = [];
  const invalid: string[] = [];
  for (const a of parts) {
    if (isEmail(a.email)) valid.push(a);
    else if (a.email.trim()) invalid.push(a.email.trim());
  }
  return { valid, invalid };
}

export const formatAddress = (a: MailAddress): string =>
  a.name ? `${a.name} <${a.email}>` : a.email;
