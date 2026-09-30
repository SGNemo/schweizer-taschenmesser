import { BankFormatError, parseBankFile } from '@/core/io/bank';
import { parseDateInput } from '@/core/io/dates';
import { detectSubscriptions, type DetectedSubscription } from '@/core/io/subscriptionDetect';
import { formatMoney, parseMoney } from '@/core/money';
import { describeRecurrence } from '@/core/recurrence/describe';
import type { Recurrence } from '@/core/recurrence/types';
import type {
  ImportCandidate,
  ImportInput,
  ImporterRuntime,
  ImportParseResult,
} from '@/core/importer/types';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { subscriptionRepo } from './repo';

const RHYTHMS: Record<string, Recurrence> = {
  monthly: { freq: 'monthly', interval: 1 },
  quarterly: { freq: 'monthly', interval: 3 },
  yearly: { freq: 'yearly', interval: 1 },
};

const nameKey = (name: string) => name.trim().toLowerCase();

const DETECTED_RHYTHMS: Record<DetectedSubscription['freq'], Recurrence> = {
  weekly: { freq: 'weekly', interval: 1 },
  monthly: { freq: 'monthly', interval: 1 },
  quarterly: { freq: 'monthly', interval: 3 },
  yearly: { freq: 'yearly', interval: 1 },
};

function fromMail(input: ImportInput): ImportParseResult {
  if (input.kind !== 'connector') return { candidates: [], notes: [] };
  const m = t.onboarding.mail;
  const candidates: ImportCandidate[] = [];
  for (const f of input.findings) {
    if (f.kind !== 'subscription' || f.amountMinor === undefined) continue;
    const recurrence = DETECTED_RHYTHMS[f.freq ?? 'monthly'];
    const start = f.date ?? f.mailDate;
    candidates.push({
      collection: 'subscription',
      data: {
        name: f.title,
        amountMinor: f.amountMinor,
        recurrence,
        startDate: start,
        active: true,
        note: f.url ? m.source(f.url) : undefined,
      },
      label: f.title,
      detail: `${formatMoney(f.amountMinor)} · ${describeRecurrence(recurrence)} · ${formatDay(start, 'd. MMM yyyy')}`,
      dedupeKey: nameKey(f.title),
      ref: f.ref,
      ...(f.date ? {} : { warning: m.startUnclear }),
    });
  }
  return { candidates, notes: [] };
}

/** Recurring debits found in a bank statement, as suggestions (nothing is stored before the preview). */
function parseBank(input: ImportInput): ImportParseResult {
  const s = t.onboarding.subscriptions;
  if (input.kind !== 'file') return { candidates: [], notes: [] };
  let transactions;
  try {
    transactions = parseBankFile(input.text).transactions;
  } catch (e) {
    if (e instanceof BankFormatError) return { candidates: [], notes: [s.bankFormat] };
    throw e;
  }
  const found = detectSubscriptions(transactions);
  if (found.length === 0) return { candidates: [], notes: [s.bankNone] };
  return {
    candidates: found.map((d) => {
      const recurrence = DETECTED_RHYTHMS[d.freq];
      return {
        collection: 'subscription',
        data: {
          name: d.payee,
          amountMinor: d.amountMinor,
          recurrence,
          startDate: d.nextDate,
          active: true,
        },
        label: d.payee,
        detail: `${formatMoney(d.amountMinor)} · ${describeRecurrence(recurrence)} · ${s.seen(d.occurrences, formatDay(d.lastDate, 'd. MMM yyyy'))}`,
        dedupeKey: nameKey(d.payee),
      };
    }),
    notes: [],
  };
}

const runtime: ImporterRuntime = {
  parse(id, input) {
    if (id === 'bank') return parseBank(input);
    if (id === 'mail') return fromMail(input);
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
