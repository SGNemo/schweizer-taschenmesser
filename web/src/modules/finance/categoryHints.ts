export interface PastBooking {
  payee?: string;
  kind: 'expense' | 'income';
  categoryId?: string;
}

const norm = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * The category earlier bookings of the same payee (and direction) used, most used first, for each
 * row of an import; `undefined` where there is no such booking. Plain look-up in the user's own
 * data: no model, nothing leaves the device, and the user can change the category afterwards.
 */
export function suggestCategories(
  past: readonly PastBooking[],
  rows: readonly { payee?: string; kind: 'expense' | 'income' }[],
): (string | undefined)[] {
  const counts = new Map<string, Map<string, number>>();
  for (const b of past) {
    if (!b.payee || !b.categoryId) continue;
    const key = `${b.kind}|${norm(b.payee)}`;
    const per = counts.get(key) ?? new Map<string, number>();
    per.set(b.categoryId, (per.get(b.categoryId) ?? 0) + 1);
    counts.set(key, per);
  }
  return rows.map((r) => {
    if (!r.payee) return undefined;
    const per = counts.get(`${r.kind}|${norm(r.payee)}`);
    if (!per) return undefined;
    return [...per.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  });
}
