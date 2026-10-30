import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { currencyOf, DEFAULT_CURRENCY } from '@/core/money';
import { settingsRepo } from '@/core/settings/settings';
import { accountSchema, categorySchema, transactionSchema } from './schema';

export const accountRepo = createRepo(tableName('finance', 'account'), accountSchema);
export const categoryRepo = createRepo(tableName('finance', 'category'), categorySchema);
export const transactionRepo = createRepo(tableName('finance', 'transaction'), transactionSchema);

export const DEFAULT_ACCOUNT_ID = 'acc-main';
export const INVOICE_CATEGORY_ID = 'cat-invoices';

const SEED_CATEGORIES = [
  ['cat-food', 'Lebensmittel', 'expense'],
  ['cat-home', 'Wohnen', 'expense'],
  ['cat-mobility', 'Mobilität', 'expense'],
  ['cat-leisure', 'Freizeit', 'expense'],
  ['cat-health', 'Gesundheit', 'expense'],
  ['cat-subs', 'Abos', 'expense'],
  [INVOICE_CATEGORY_ID, 'Rechnungen', 'expense'],
  ['cat-other', 'Sonstiges', 'expense'],
  ['cat-salary', 'Gehalt', 'income'],
  ['cat-side-job', 'Nebenjob', 'income'],
  ['cat-grant', 'BAföG / Stipendium', 'income'],
  ['cat-income-other', 'Sonstige Einnahmen', 'income'],
] as const;

/** Ids of the categories every installation starts with; anything else was added by the user. */
export const DEFAULT_CATEGORY_IDS: ReadonlySet<string> = new Set(SEED_CATEGORIES.map((c) => c[0]));

const SETTINGS_SCOPE = 'module.finance';

/**
 * Creates a default account and categories once. Fixed ids make devices converge on the same
 * records instead of duplicating them; a flag in the (synced) settings prevents re-seeding
 * after the user deleted them on purpose.
 */
export async function ensureDefaults(): Promise<void> {
  if ((await settingsRepo.get(SETTINGS_SCOPE))?.seeded === true) return;
  if (
    !(await accountRepo.table.get(DEFAULT_ACCOUNT_ID)) &&
    (await accountRepo.active().count()) === 0
  ) {
    await accountRepo.create(
      { name: 'Girokonto', openingBalanceMinor: 0, order: 0 },
      { id: DEFAULT_ACCOUNT_ID },
    );
  }
  for (const [id, name, kind] of SEED_CATEGORIES) {
    if (!(await categoryRepo.table.get(id))) await categoryRepo.create({ name, kind }, { id });
  }
  const current = await settingsRepo.get(SETTINGS_SCOPE);
  await settingsRepo.upsert(SETTINGS_SCOPE, {
    ...(current ? stripEnvelope(current) : {}),
    seeded: true,
  });
}

function stripEnvelope(row: Record<string, unknown>): Record<string, unknown> {
  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    deviceId: _d,
    deletedAt: _x,
    _f: _f,
    ...rest
  } = row;
  return rest;
}

/**
 * The account new automatic bookings go to: the first one in `currency` (the euro by default);
 * creates/revives the default if none exists. Another currency without an account gets one named
 * after its code, so nothing is ever booked in the wrong currency.
 */
export async function primaryAccountId(currency: string = DEFAULT_CURRENCY): Promise<string> {
  const accounts = await accountRepo.active().sortBy('order');
  const match = accounts.find((a) => currencyOf(a) === currency);
  if (match) return match.id;
  if (currency !== DEFAULT_CURRENCY) {
    const created = await accountRepo.create({
      name: currency,
      openingBalanceMinor: 0,
      currency,
      order: accounts.length,
    });
    return created.id;
  }
  const existing = await accountRepo.table.get(DEFAULT_ACCOUNT_ID);
  if (existing) {
    await accountRepo.restore(DEFAULT_ACCOUNT_ID);
    return DEFAULT_ACCOUNT_ID;
  }
  await accountRepo.create(
    { name: 'Girokonto', openingBalanceMinor: 0, order: 0 },
    { id: DEFAULT_ACCOUNT_ID },
  );
  return DEFAULT_ACCOUNT_ID;
}

/** Deletes an account together with all its transactions (tombstones). */
export async function deleteAccount(accountId: string): Promise<void> {
  const ids = (await transactionRepo.table.where('accountId').equals(accountId).toArray())
    .filter((t) => t.deletedAt === null)
    .map((t) => t.id);
  await transactionRepo.removeMany(ids);
  await accountRepo.remove(accountId);
}
