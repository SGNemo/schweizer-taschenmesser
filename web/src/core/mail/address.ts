import type { MailAddress } from './types';

/** `"Name" <a@b>`, `Name <a@b>` or a bare address. */
export function parseAddress(raw: string): MailAddress {
  // Linear on purpose (Q1, launch review 2026-11): the regular expression this replaced backtracked
  // cubically on a header with many leading tabs.
  const text = raw.trim();
  const open = text.indexOf('<');
  if (open >= 0 && text.endsWith('>')) {
    const email = text.slice(open + 1, -1).trim();
    let name = text.slice(0, open).trim();
    if (name.startsWith('"')) name = name.slice(1);
    if (name.endsWith('"')) name = name.slice(0, -1);
    if (email && !email.includes('>') && !name.includes('"')) {
      return { name: name.trim() || undefined, email };
    }
  }
  return { email: text };
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
