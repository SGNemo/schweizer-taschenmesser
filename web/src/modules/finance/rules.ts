/**
 * Rules of the bank import: a pattern on the payee (or, without a payee, the purpose) → category and
 * optionally a subscription. Small and pure: matching is normalized, proposals are computed from the
 * user's own data and names the app already ships (the subscription suggestions). Nothing here
 * stores anything and nothing is ever created without the user's confirmation.
 */
import { normalizeHeader } from '@/core/io/csv';

export interface BankRule {
  id: string;
  /** Normalized text a payee must contain (on word boundaries). */
  match: string;
  categoryId?: string;
  subscriptionId?: string;
}

/** Lower case, no diacritics, punctuation = one space, reference numbers (digits only) dropped. */
export function normalizePayee(text: string): string {
  return normalizeHeader(text)
    .split(' ')
    .filter((token) => token !== '' && !/^\d+$/.test(token))
    .join(' ');
}

const contains = (haystack: string, needle: string): boolean =>
  needle !== '' && ` ${haystack} `.includes(` ${needle} `);

/** The rule for a booking: the most specific (longest) pattern that matches payee or purpose. */
export function findRule(
  rules: readonly BankRule[],
  booking: { payee?: string; purpose?: string },
): BankRule | undefined {
  const payee = normalizePayee(booking.payee ?? '');
  const text = payee || normalizePayee(booking.purpose ?? '');
  let best: BankRule | undefined;
  for (const rule of rules) {
    if (!contains(text, rule.match)) continue;
    if (!best || rule.match.length > best.match.length) best = rule;
  }
  return best;
}

export interface RuleProposal {
  /** The text the new rule would match (normalized). */
  match: string;
  /** The payee as the bank prints it, for the line the user reads. */
  payee: string;
  categoryId?: string;
  subscriptionId?: string;
  subscriptionName?: string;
}

export interface ProposalInput {
  /** The new bookings of the file. */
  bookings: readonly { payee: string; kind: 'expense' | 'income' }[];
  rules: readonly BankRule[];
  subscriptions: readonly { id: string; name: string }[];
  /** Typical provider names the app ships for subscriptions (the same list the form offers). */
  providerNames: readonly string[];
  /** Earlier bookings of the user. */
  past: readonly { payee?: string; kind: 'expense' | 'income'; categoryId?: string }[];
  /** Category for subscriptions and providers ("Abos"); unset when the user has none. */
  subscriptionCategoryId?: string;
  /** Only categories that still exist may be proposed. */
  categoryIds: ReadonlySet<string>;
  /** At most this many lines. */
  limit?: number;
}

/** An earlier payee must have been put into the same category this often to be proposed. */
const MIN_PAST = 2;

function pastCategory(
  past: ProposalInput['past'],
  payee: string,
  kind: 'expense' | 'income',
  categoryIds: ReadonlySet<string>,
): string | undefined {
  const counts = new Map<string, number>();
  for (const b of past) {
    if (b.kind !== kind || !b.categoryId || !b.payee || !categoryIds.has(b.categoryId)) continue;
    if (normalizePayee(b.payee) !== payee) continue;
    counts.set(b.categoryId, (counts.get(b.categoryId) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= MIN_PAST ? top[0] : undefined;
}

/**
 * One proposal per new payee that has something to propose: a subscription of the user whose name
 * is in the payee, a known provider name, or a category earlier bookings of that payee shared.
 * Payees a rule already covers are left out, so a confirmed rule is never offered again.
 */
export function proposeRules(input: ProposalInput): RuleProposal[] {
  const out: RuleProposal[] = [];
  const seen = new Set<string>();
  const subs = input.subscriptions
    .map((s) => ({ ...s, key: normalizePayee(s.name) }))
    .filter((s) => s.key !== '');
  const providers = input.providerNames.map(normalizePayee).filter(Boolean);
  const subsCategory =
    input.subscriptionCategoryId && input.categoryIds.has(input.subscriptionCategoryId)
      ? input.subscriptionCategoryId
      : undefined;
  for (const b of input.bookings) {
    const payee = normalizePayee(b.payee);
    if (!payee || seen.has(payee) || findRule(input.rules, { payee: b.payee })) continue;
    seen.add(payee);
    const sub = b.kind === 'expense' ? subs.find((s) => contains(payee, s.key)) : undefined;
    if (sub) {
      out.push({
        match: sub.key,
        payee: b.payee,
        subscriptionId: sub.id,
        subscriptionName: sub.name,
        ...(subsCategory ? { categoryId: subsCategory } : {}),
      });
      continue;
    }
    const provider = b.kind === 'expense' ? providers.find((p) => contains(payee, p)) : undefined;
    if (provider && subsCategory) {
      out.push({ match: provider, payee: b.payee, categoryId: subsCategory });
      continue;
    }
    const categoryId = pastCategory(input.past, payee, b.kind, input.categoryIds);
    if (categoryId) out.push({ match: payee, payee: b.payee, categoryId });
  }
  return out.slice(0, input.limit ?? 5);
}

export const SUBSCRIPTION_REF_PREFIX = 'subscription:';
