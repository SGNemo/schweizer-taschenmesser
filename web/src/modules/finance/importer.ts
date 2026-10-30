import { BankFormatError, bankDedupeKey, parseBankFile } from '@/core/io/bank';
import { currencyOf, formatMoney, parseMoney, formatMoneyInput } from '@/core/money';
import type { ImportInput, ImporterRuntime, ImportParseResult } from '@/core/importer/types';
import { t } from '@/strings';
import { formatDay } from '@/core/time/dates';
import { accountRepo, categoryRepo, transactionRepo } from './repo';
import { suggestCategories } from './categoryHints';

const nameKey = (name: string) => name.trim().toLowerCase();

const MAX_BANK_ROWS = 2000;

async function parseBank(
  input: ImportInput,
  accountId: string,
  currency: string,
): Promise<ImportParseResult> {
  const s = t.onboarding.finance;
  if (input.kind !== 'file') return { candidates: [], notes: [] };
  if (!accountId) return { candidates: [], notes: [s.noAccounts] };
  let parsed;
  try {
    parsed = parseBankFile(input.text);
  } catch (e) {
    if (e instanceof BankFormatError) return { candidates: [], notes: [s.bankFormat] };
    throw e;
  }
  const notes: string[] = [];
  if (parsed.skipped > 0) notes.push(s.bankSkipped(parsed.skipped));
  let rows = parsed.transactions;
  if (rows.length > MAX_BANK_ROWS) {
    notes.push(s.bankTruncated(MAX_BANK_ROWS));
    rows = rows.slice(0, MAX_BANK_ROWS);
  }
  // The same booking may legitimately occur twice on a day (two coffees): number the repeats so
  // that only a second import of the same file, not the repeat itself, counts as a duplicate.
  const seen = new Map<string, number>();
  const keyed = (tx: (typeof rows)[number]) => {
    const base = bankDedupeKey(tx);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}#${n}`;
  };
  // Earlier bookings of the same payee suggest the category (shown in the row, changeable later).
  const kindOf = (tx: (typeof rows)[number]) => (tx.amountMinor < 0 ? 'expense' : 'income');
  const [past, categories] = await Promise.all([
    transactionRepo.active().toArray(),
    categoryRepo.active().toArray(),
  ]);
  const hints = suggestCategories(
    past,
    rows.map((tx) => ({ payee: tx.payee, kind: kindOf(tx) })),
  );
  const categoryName = (id: string | undefined) => categories.find((c) => c.id === id)?.name;
  return {
    candidates: rows.map((tx, i) => {
      const categoryId = categoryName(hints[i]) ? hints[i] : undefined;
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
      };
    }),
    notes,
  };
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
