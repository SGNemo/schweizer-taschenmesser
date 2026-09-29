import { parseDateInput } from '@/core/io/dates';
import { formatMoney, parseMoney } from '@/core/money';
import { describeRecurrence } from '@/core/recurrence/describe';
import type { Recurrence } from '@/core/recurrence/types';
import type { ImporterRuntime } from '@/core/importer/types';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { subscriptionRepo } from './repo';

const RHYTHMS: Record<string, Recurrence> = {
  monthly: { freq: 'monthly', interval: 1 },
  quarterly: { freq: 'monthly', interval: 3 },
  yearly: { freq: 'yearly', interval: 1 },
};

const nameKey = (name: string) => name.trim().toLowerCase();

const runtime: ImporterRuntime = {
  parse(_id, input) {
    if (input.kind !== 'form') return { candidates: [], notes: [] };
    const v = input.values;
    const name = (v.name ?? '').trim();
    const amount = parseMoney(v.amount ?? '');
    const next = parseDateInput(v.next ?? '');
    const recurrence = RHYTHMS[v.rhythm ?? 'monthly'];
    const noticeText = (v.notice ?? '').trim();
    const notice = noticeText === '' ? undefined : Number(noticeText);
    const s = t.onboarding.subscriptions;
    if (!name) return { candidates: [], notes: [t.onboarding.required] };
    if (amount === undefined || amount < 1) return { candidates: [], notes: [s.badAmount] };
    if (!next || !recurrence) return { candidates: [], notes: [s.badDate] };
    if (notice !== undefined && (!Number.isInteger(notice) || notice < 0 || notice > 365))
      return { candidates: [], notes: [s.badNotice] };
    return {
      candidates: [
        {
          collection: 'subscription',
          data: {
            name,
            amountMinor: amount,
            recurrence,
            startDate: next,
            active: true,
            ...(notice !== undefined ? { cancelNoticeDays: notice } : {}),
          },
          label: name,
          detail: `${formatMoney(amount)} · ${describeRecurrence(recurrence)} · nächste Abbuchung ${formatDay(next, 'd. MMM yyyy')}`,
          dedupeKey: nameKey(name),
        },
      ],
      notes: [],
    };
  },
  async existingKeys() {
    return new Set((await subscriptionRepo.active().toArray()).map((s) => nameKey(s.name)));
  },
};

export default runtime;
