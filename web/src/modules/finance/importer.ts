import { createElement } from 'react';
import { bankDedupeKey, type BankTransaction } from '@/core/io/bank';
import { currencyOf, formatMoney, parseMoney, formatMoneyInput } from '@/core/money';
import type {
  ImportCandidate,
  ImportInput,
  ImporterRuntime,
  ImportParseResult,
  PreviewRow,
} from '@/core/importer/types';
import { t } from '@/strings';
import { formatDay } from '@/core/time/dates';
import { listSubscriptionNames } from '@/modules/subscriptions/public';
import { accountRepo, categoryRepo, transactionRepo } from './repo';
import { suggestCategories } from './categoryHints';
import { MAPPING_EXTRA, readBank } from './bankRead';
import { ColumnMapping } from './components/ColumnMapping';
import { RuleSuggestions } from './components/RuleSuggestions';
import {
  findRule,
  proposeRules,
  SUBSCRIPTION_REF_PREFIX,
  type BankRule,
  type RuleProposal,
} from './rules';
import { addRules, loadRules } from './rulesStore';

const nameKey = (name: string) => name.trim().toLowerCase();

const MAX_BANK_ROWS = 2000;
const FORMAT_NAMES = { csv: 'CSV', camt: 'CAMT', ofx: 'OFX', qif: 'QIF' } as const;

async function parseBank(
  input: ImportInput,
  accountId: string,
  currency: string,
): Promise<ImportParseResult> {
  const s = t.onboarding.finance;
  if (input.kind !== 'file') return { candidates: [], notes: [] };
  if (!accountId) return { candidates: [], notes: [s.noAccounts] };
  const read = await readBank(input.text, input.extras);
  if (read.kind === 'unknown-format') return { candidates: [], notes: [s.bankFormat] };
  if (read.kind === 'needs-mapping') {
    const { inspection } = read;
    return {
      candidates: [],
      notes: [s.bankNeedsMapping],
      slot: {
        placement: 'resolve',
        Panel: ({ busy, submit }) =>
          createElement(ColumnMapping, {
            inspection,
            busy,
            onSubmit: (mapping) => submit({ [MAPPING_EXTRA]: JSON.stringify(mapping) }),
          }),
      },
    };
  }
  const { parsed } = read;
  const notes: string[] = [
    'preset' in read.source
      ? s.bankDetected(read.source.preset)
      : 'remembered' in read.source
        ? s.bankRemembered
        : s.bankDetected(FORMAT_NAMES[read.source.format]),
  ];
  if (parsed.skipped > 0) notes.push(s.bankSkipped(parsed.skipped));
  // A file in another currency is never booked to this account (no conversion): said once, calmly.
  const foreign = parsed.transactions.filter((tx) => tx.currency && tx.currency !== currency);
  let rows = parsed.transactions.filter((tx) => !tx.currency || tx.currency === currency);
  if (foreign.length > 0)
    notes.push(s.bankCurrencySkipped(foreign.length, foreign[0]!.currency, currency));
  if (rows.length > MAX_BANK_ROWS) {
    notes.push(s.bankTruncated(MAX_BANK_ROWS));
    rows = rows.slice(0, MAX_BANK_ROWS);
  }
  // The same booking may legitimately occur twice on a day (two coffees): number the repeats so
  // that only a second import of the same file, not the repeat itself, counts as a duplicate.
  const seen = new Map<string, number>();
  const keyed = (tx: BankTransaction) => {
    const base = bankDedupeKey(tx);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}#${n}`;
  };
  // Earlier bookings of the same payee suggest the category (shown in the row, changeable later).
  const kindOf = (tx: BankTransaction) => (tx.amountMinor < 0 ? 'expense' : 'income');
  const [past, categories, rules, subscriptions] = await Promise.all([
    transactionRepo.active().toArray(),
    categoryRepo.active().toArray(),
    loadRules(),
    listSubscriptionNames(),
  ]);
  const hints = suggestCategories(
    past,
    rows.map((tx) => ({ payee: tx.payee, kind: kindOf(tx) })),
  );
  const categoryName = (id: string | undefined) => categories.find((c) => c.id === id)?.name;
  const subscriptionName = (id: string | undefined) => subscriptions.find((x) => x.id === id)?.name;

  // What a confirmed rule (or an earlier booking of the payee) puts on a row.
  const build = (
    tx: BankTransaction,
    i: number,
    rule: Pick<BankRule, 'categoryId' | 'subscriptionId'> | undefined,
    chip: string | undefined,
  ): ImportCandidate => {
    const ruleCategory = categoryName(rule?.categoryId) ? rule?.categoryId : undefined;
    const categoryId = ruleCategory ?? (categoryName(hints[i]) ? hints[i] : undefined);
    const subId = subscriptionName(rule?.subscriptionId) ? rule?.subscriptionId : undefined;
    return {
      collection: 'transaction',
      data: {
        accountId,
        kind: kindOf(tx),
        amountMinor: Math.abs(tx.amountMinor),
        date: tx.date,
        ...(categoryId ? { categoryId } : {}),
        ...(tx.payee ? { payee: tx.payee } : {}),
        ...(tx.purpose ? { note: tx.purpose } : {}),
        ...(subId ? { sourceRef: `${SUBSCRIPTION_REF_PREFIX}${subId}` } : {}),
      },
      label: tx.payee || tx.purpose || formatMoney(Math.abs(tx.amountMinor), currency),
      // Payee is the title; the purpose and a suggested category follow in the detail line.
      detail: [
        `${formatDay(tx.date, 'd. MMM yyyy')} · ${tx.amountMinor < 0 ? '−' : '+'}${formatMoney(Math.abs(tx.amountMinor), currency)}`,
        tx.payee ? tx.purpose : '',
        categoryId ? categoryName(categoryId) : '',
      ]
        .filter(Boolean)
        .join(' · '),
      dedupeKey: keyed(tx),
      ...(chip ? { warning: chip } : {}),
    };
  };
  const chipFor = (rule: BankRule) =>
    t.finance.rules.applied(
      subscriptionName(rule.subscriptionId) ?? categoryName(rule.categoryId) ?? '',
    );
  const candidates = rows.map((tx, i) => {
    const rule = findRule(rules, tx);
    const useful = rule && (categoryName(rule.categoryId) || subscriptionName(rule.subscriptionId));
    return build(tx, i, useful ? rule : undefined, useful ? chipFor(rule) : undefined);
  });

  // Proposals for new payees: shown below the preview, ticked by hand, a rule only after "Importieren".
  const proposals = proposeRules({
    bookings: rows.map((tx) => ({ payee: tx.payee, kind: kindOf(tx) })),
    rules,
    subscriptions,
    providerNames: t.onboarding.subscriptions.suggestions,
    past,
    subscriptionCategoryId: categories.find((c) => c.id === 'cat-subs')?.id,
    categoryIds: new Set(categories.map((c) => c.id)),
  });
  const chosen = new Set<string>();
  const slot =
    proposals.length === 0
      ? undefined
      : ({
          placement: 'preview' as const,
          Panel: ({ rows: previewRows, onChange }) =>
            createElement(RuleSuggestions, {
              proposals: proposals.map((p) => ({
                proposal: p,
                label: proposalText(p, categoryName(p.categoryId)),
              })),
              chosen,
              // Ticking a proposal shows its effect on the rows of that payee right away.
              onToggle: (p: RuleProposal, on: boolean) =>
                onChange(
                  previewRows.map((r) => {
                    const tx = rows[r.index];
                    if (!tx || r.candidate.update || !findRule([ruleOf(p)], tx)) return r;
                    const base = build(
                      tx,
                      r.index,
                      on ? p : undefined,
                      on ? chipFor(ruleOf(p)) : undefined,
                    );
                    return { ...r, candidate: { ...base, dedupeKey: r.candidate.dedupeKey } };
                  }),
                ),
            }),
          async onCommitted(_: PreviewRow[]) {
            await addRules(proposals.filter((p) => chosen.has(p.match)));
          },
        } satisfies ImportParseResult['slot']);
  return { candidates, notes, ...(slot ? { slot } : {}) };
}

const ruleOf = (p: RuleProposal): BankRule => ({
  id: p.match,
  match: p.match,
  ...(p.categoryId ? { categoryId: p.categoryId } : {}),
  ...(p.subscriptionId ? { subscriptionId: p.subscriptionId } : {}),
});

function proposalText(p: RuleProposal, category: string | undefined): string {
  const r = t.finance.rules;
  const payee = p.payee.length > 40 ? `${p.payee.slice(0, 39)}…` : p.payee;
  if (p.subscriptionName && category) return r.proposalBoth(payee, p.subscriptionName, category);
  if (p.subscriptionName) return r.proposalSubscription(payee, p.subscriptionName);
  return r.proposalCategory(payee, category ?? '');
}

const runtime: ImporterRuntime = {
  async parse(id, input, ctx) {
    if (id === 'bank') {
      const accountId = ctx.options.accountId ?? '';
      const account = accountId ? await accountRepo.get(accountId) : undefined;
      return await parseBank(input, accountId, currencyOf(account));
    }
    if (input.kind !== 'form') return { candidates: [], notes: [] };
    const name = (input.values.name ?? '').trim();
    const balance = parseMoney(input.values.balance ?? '', { allowNegative: true });
    if (!name) return { candidates: [], notes: [t.onboarding.required] };
    if (balance === undefined)
      return { candidates: [], notes: [t.onboarding.finance.badBalance(formatMoneyInput(123456))] };
    const order = await accountRepo.active().count();
    return {
      candidates: [
        {
          collection: 'account',
          data: { name, openingBalanceMinor: balance, order },
          label: name,
          detail: `Startsaldo ${formatMoney(balance)}`,
          dedupeKey: nameKey(name),
        },
      ],
      notes: [],
    };
  },
  async existingKeys(collection) {
    if (collection === 'transaction') {
      const all = await transactionRepo.active().toArray();
      const counts = new Map<string, number>();
      return new Set(
        all.map((tx) => {
          const base = bankDedupeKey({
            date: tx.date,
            amountMinor: tx.kind === 'expense' ? -tx.amountMinor : tx.amountMinor,
            currency: 'EUR',
            payee: tx.payee ?? '',
            purpose: tx.note ?? '',
          });
          const n = (counts.get(base) ?? 0) + 1;
          counts.set(base, n);
          return `${base}#${n}`;
        }),
      );
    }
    return new Set((await accountRepo.active().toArray()).map((a) => nameKey(a.name)));
  },
  async optionChoices(key) {
    if (key !== 'accountId') return [];
    const accounts = (await accountRepo.active().toArray()).sort((a, b) => a.order - b.order);
    return accounts.map((a) => ({ value: a.id, label: a.name }));
  },
};

export default runtime;
