/**
 * Amounts in bank files whose decimal mark is not known in advance (QIF from a German bank prints
 * "-1.234,56", an American one "-1,234.56"). Pure; returns signed cents or `undefined`.
 */
export function parseLooseAmount(input: string): number | undefined {
  let s = input.replace(/[\s\u00a0\u202f€$£¥']/g, '').replace(/^\+/, '');
  if (!s) return undefined;
  let negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  } else if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  // A trailing minus ("12,50-") is used by some exports.
  if (s.endsWith('-')) {
    negative = true;
    s = s.slice(0, -1);
  }
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let decimalAt = -1;
  if (lastComma >= 0 && lastDot >= 0) decimalAt = Math.max(lastComma, lastDot);
  else {
    const mark = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : '';
    if (mark) {
      const parts = s.split(mark);
      // "1.234" and "1.234.567" group thousands; "12.5", "12,50" are decimals.
      if (parts.length === 2 && parts[1]!.length !== 3) decimalAt = s.lastIndexOf(mark);
      else if (parts.length === 2 && parts[0] === '0') decimalAt = s.lastIndexOf(mark);
    }
  }
  const whole = (decimalAt >= 0 ? s.slice(0, decimalAt) : s).replace(/[.,]/g, '');
  const fraction = decimalAt >= 0 ? s.slice(decimalAt + 1) : '';
  if (!/^\d*$/.test(whole) || !/^\d{0,2}$/.test(fraction) || (!whole && !fraction))
    return undefined;
  const minor = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(minor)) return undefined;
  return negative ? -minor : minor;
}
