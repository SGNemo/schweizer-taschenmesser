import { parseDateInput } from '@/core/io/dates';
import { formatMoney, parseMoney } from '@/core/money';
import type {
  ImportCandidate,
  ImporterRuntime,
  ImportParseResult,
  ImportInput,
} from '@/core/importer/types';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { invoiceRepo } from './repo';

const keyOf = (payee: string, amountMinor: number, dueDate: string) =>
  `${payee.trim().toLowerCase()}|${amountMinor}|${dueDate}`;

function fromMail(input: ImportInput): ImportParseResult {
  if (input.kind !== 'connector') return { candidates: [], notes: [] };
  const m = t.onboarding.mail;
  const candidates: ImportCandidate[] = [];
  let skipped = 0;
  for (const f of input.findings) {
    if (f.kind !== 'invoice') continue;
    if (f.amountMinor === undefined) {
      skipped += 1;
      continue;
    }
    const due = f.date ?? f.mailDate;
    candidates.push({
      collection: 'invoice',
      data: {
        payee: f.title,
        amountMinor: f.amountMinor,
        dueDate: due,
        status: 'open',
        note: f.url ? m.source(f.url) : undefined,
      },
      label: f.title,
      detail: t.invoices.importDetail(formatMoney(f.amountMinor), formatDay(due, 'd. MMM yyyy')),
      dedupeKey: keyOf(f.title, f.amountMinor, due),
      ref: f.ref,
      ...(f.date ? {} : { warning: m.dueUnclear }),
    });
  }
  return { candidates, notes: skipped > 0 ? [m.noAmount(skipped)] : [] };
}

const runtime: ImporterRuntime = {
  parse(id, input) {
    if (id === 'mail') return fromMail(input);
    if (input.kind !== 'form') return { candidates: [], notes: [] };
    const v = input.values;
    const payee = (v.payee ?? '').trim();
    const amount = parseMoney(v.amount ?? '');
    const due = parseDateInput(v.due ?? '');
    if (!payee) return { candidates: [], notes: [t.onboarding.required] };
    if (amount === undefined || amount < 1)
      return { candidates: [], notes: [t.onboarding.invoices.badAmount] };
    if (!due) return { candidates: [], notes: [t.onboarding.invoices.badDate] };
    const reference = (v.reference ?? '').trim();
    return {
      candidates: [
        {
          collection: 'invoice',
          data: {
            payee,
            amountMinor: amount,
            dueDate: due,
            status: 'open',
            ...(reference ? { reference } : {}),
          },
          label: payee,
          detail: t.invoices.importDetail(formatMoney(amount), formatDay(due, 'd. MMM yyyy')),
          dedupeKey: keyOf(payee, amount, due),
        },
      ],
      notes: [],
    };
  },
  async existingKeys() {
    const rows = await invoiceRepo.active().toArray();
    return new Set(rows.map((r) => keyOf(r.payee, r.amountMinor, r.dueDate)));
  },
};

export default runtime;
