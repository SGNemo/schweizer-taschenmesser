import { formatMoney, parseMoney } from '@/core/money';
import type { ImporterRuntime } from '@/core/importer/types';
import { t } from '@/strings';
import { accountRepo } from './repo';

const nameKey = (name: string) => name.trim().toLowerCase();

const runtime: ImporterRuntime = {
  async parse(_id, input) {
    if (input.kind !== 'form') return { candidates: [], notes: [] };
    const name = (input.values.name ?? '').trim();
    const balance = parseMoney(input.values.balance ?? '', { allowNegative: true });
    if (!name) return { candidates: [], notes: [t.onboarding.required] };
    if (balance === undefined) return { candidates: [], notes: [t.onboarding.finance.badBalance] };
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
  async existingKeys() {
    return new Set((await accountRepo.active().toArray()).map((a) => nameKey(a.name)));
  },
};

export default runtime;
