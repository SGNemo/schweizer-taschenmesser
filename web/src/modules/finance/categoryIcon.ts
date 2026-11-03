import type { IconName } from '@/ui';

/** Icons of the categories every installation starts with (fixed ids, `repo.ts`). */
const BY_ID: Record<string, IconName> = {
  'cat-food': 'cart',
  'cat-home': 'home',
  'cat-mobility': 'car',
  'cat-leisure': 'dice',
  'cat-health': 'activity',
  'cat-subs': 'repeat',
  'cat-invoices': 'receipt',
  'cat-other': 'package',
  'cat-salary': 'wallet',
  'cat-side-job': 'coins',
  'cat-grant': 'target',
  'cat-income-other': 'coins',
};

/** Own categories: a few words in the five app languages; the first match wins, no match is neutral. */
const BY_WORD: readonly [RegExp, IconName][] = [
  [
    /lebensmittel|essen|restaurant|caf[eé]|food|grocer|comida|alimenta|nourriture|courses|mercado|supermerc/i,
    'cart',
  ],
  [/miete|wohn|rent|home|alquiler|hogar|loyer|logement|aluguel|casa/i, 'home'],
  [
    /auto|tank|benzin|verkehr|bahn|bus|mobil|transport|fuel|gas|car\b|coche|voiture|carro|combust/i,
    'car',
  ],
  [/freizeit|kino|sport|hobby|leisure|fun|ocio|loisir|lazer/i, 'dice'],
  [/gesund|arzt|apotheke|health|salud|sant[eé]|sa[uú]de|m[eé]dic|doctor/i, 'activity'],
  [/abo|subscript|suscrip|abonn|assinatura/i, 'repeat'],
  [/rechnung|invoice|factura|facture|fatura|steuer|tax|impuesto|imp[oô]t|imposto/i, 'receipt'],
  [/gehalt|lohn|salary|wage|sueldo|salaire|sal[aá]rio/i, 'wallet'],
  [/geschenk|gift|regalo|cadeau|presente/i, 'gift'],
  [/reise|urlaub|travel|viaje|voyage|viagem/i, 'luggage'],
  [/sparen|saving|ahorro|[eé]pargne|poupan/i, 'piggy'],
];

/** The icons a user can pick for an own category (the ones the derivation above also uses). */
export const CATEGORY_ICONS: readonly IconName[] = [
  'cart',
  'home',
  'car',
  'dice',
  'activity',
  'repeat',
  'receipt',
  'wallet',
  'coins',
  'gift',
  'luggage',
  'piggy',
  'target',
  'package',
];

/** The icon for a category row: the picked one, else the default categories by id, own ones by their name, otherwise a neutral one. */
export function categoryIcon(
  category: { id: string; name: string; icon?: string } | undefined,
): IconName {
  if (!category) return 'package';
  const picked = CATEGORY_ICONS.find((i) => i === category.icon);
  if (picked) return picked;
  return BY_ID[category.id] ?? BY_WORD.find(([re]) => re.test(category.name))?.[1] ?? 'package';
}
