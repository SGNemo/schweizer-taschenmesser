/** IBAN helpers (pure): normalising, the ISO 13616 mod-97 check and grouping in fours. */

/** Upper case, no spaces or dashes. */
export const normalizeIban = (s: string): string => s.replace(/[\s-]+/g, '').toUpperCase();

/** "DE89370400440532013000" → "DE89 3704 0044 0532 0130 00". */
export const formatIban = (s: string): string => normalizeIban(s).replace(/(.{4})(?=.)/g, '$1 ');

/**
 * Structure and checksum (mod 97 = 1). Says nothing about whether the account exists; a typing
 * slip is what it catches. Country length tables are not checked, only 15–34 characters.
 */
export function ibanValid(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const ch of moved) {
    const digits = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}
