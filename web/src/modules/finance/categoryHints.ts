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

/**
 * Default categories for payees and purposes everybody has (German shops, rent, energy, fuel,
 * salary): used only when no earlier booking of the payee says otherwise, shown in the preview row
 * and changeable later. Whole words only, so "Gasthaus" is never "Gas".
 */
const KEYWORDS: readonly { id: string; kind: 'expense' | 'income'; words: readonly string[] }[] = [
  {
    id: 'cat-food',
    kind: 'expense',
    words: [
      'rewe',
      'edeka',
      'aldi',
      'lidl',
      'penny',
      'netto',
      'kaufland',
      'norma',
      'tegut',
      'alnatura',
      "denn's",
      'denns',
      'baeckerei',
      'metzgerei',
      'lebensmittel',
      'supermarkt',
    ],
  },
  {
    id: 'cat-home',
    kind: 'expense',
    words: ['miete', 'hausverwaltung', 'stadtwerke', 'strom', 'nebenkosten', 'rundfunkbeitrag'],
  },
  {
    id: 'cat-mobility',
    kind: 'expense',
    words: [
      'tankstelle',
      'aral',
      'esso',
      'shell',
      'deutsche bahn',
      'db vertrieb',
      'deutschlandticket',
    ],
  },
  { id: 'cat-health', kind: 'expense', words: ['apotheke', 'zahnarzt', 'arztpraxis'] },
  { id: 'cat-salary', kind: 'income', words: ['gehalt', 'lohn', 'bezuege'] },
];

// Umlauts are spelled out before matching ("Bäckerei" → "baeckerei"), so the list stays ASCII.
const ASCII: Record<string, string> = {
  '\u00e4': 'ae',
  '\u00f6': 'oe',
  '\u00fc': 'ue',
  '\u00df': 'ss',
};
const ascii = (s: string) => s.replace(/[\u00e4\u00f6\u00fc\u00df]/g, (c) => ASCII[c] ?? c);
const LETTER = 'a-z0-9';
const MATCHERS = KEYWORDS.map((k) => ({
  ...k,
  re: new RegExp(`(^|[^${LETTER}])(${k.words.join('|')})($|[^${LETTER}])`),
}));

export function keywordCategory(row: {
  payee?: string;
  purpose?: string;
  kind: 'expense' | 'income';
}): string | undefined {
  const text = ascii(norm(`${row.payee ?? ''} ${row.purpose ?? ''}`));
  if (!text) return undefined;
  return MATCHERS.find((m) => m.kind === row.kind && m.re.test(text))?.id;
}
