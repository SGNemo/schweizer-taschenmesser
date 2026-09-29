import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
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
  ['cat-income-other', 'Sonstige Einnahmen', 'income'],
] as const;

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

/** The account new automatic bookings go to: the first one; creates/revives the default if none exists. */
export async function primaryAccountId(): Promise<string> {
  const first = (await accountRepo.active().sortBy('order'))[0];
  if (first) return first.id;
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
