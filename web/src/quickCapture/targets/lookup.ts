import { createCollectionRepo } from '@/core/db/repo';
import type { TaschenmesserDB } from '@/core/db/db';
import { loadModuleStates, type ModuleStates } from '@/core/modules/activation';
import { getManifest, visibleManifests } from '@/core/modules/registry';
import { addDaysStr } from '@/core/time/dates';
import type { CaptureFields } from '../parser';
import { openRest } from './adapters';
import type { OpenInvoice } from './types';

export type InvoiceLookup = { match: OpenInvoice } | { candidates: OpenInvoice[] };

/** A reminder may add a fee: the amount may lie this much above the open rest (cents or share). */
const FEE_MINOR = 2000;
const FEE_SHARE = 0.25;
/** A reminder and a payment cross in the post: a payee paid this many days before still makes it unsure. */
const CROSSED_DAYS = 45;

/** Words around a payee in a reminder line that are not part of its name. */
const NOISE = new Set([
  'zahlen',
  'bezahlen',
  'überweisen',
  'begleichen',
  'prüfen',
  'an',
  'für',
  'von',
  'die',
  'der',
  'das',
  'den',
]);
/** Legal forms dropped when comparing names. */
const FORMS = /\b(gmbh|ag|kg|ohg|ug|e\.?\s?v|mbh|co|se|inc|ltd)\b\.?/gu;

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(FORMS, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean);

/** The names an invoice is known by: its payee, and whoever it collects for („… im Auftrag von X“). */
function names(payee: string): string[][] {
  const lower = payee.toLowerCase();
  const i = lower.indexOf('im auftrag von');
  const all = [words(payee)];
  if (i >= 0) all.push(words(payee.slice(i + 'im auftrag von'.length)));
  return all.filter((n) => n.length > 0);
}

/** „Stadtwerke“ names „Stadtwerke Musterstadt GmbH“: the typed words are the start of the name. */
function namesPayee(query: string[], name: string[]): boolean {
  return query.length > 0 && query.length <= name.length && query.every((w, i) => name[i] === w);
}

const compact = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Finds the open invoice a payment reminder belongs to. A pure read through the manifest repo (live
 * records only); `undefined` while the invoices module is off or no invoice of that payee exists (a new
 * one may then be made). Order: a reference or invoice number in the line → the payee by name prefix
 * (also after „im Auftrag von“) with an amount at least the open rest and at most the rest plus a fee
 * → the oldest overdue. Unsure comes back as `candidates`, possibly empty: several equally good ones,
 * a known payee whose amount does not fit, or one paid in the last weeks (the line then becomes a ToDo
 * „… prüfen“).
 */
export async function findOpenInvoice(
  fields: CaptureFields,
  opts: { today: string; database?: TaschenmesserDB; states?: ModuleStates },
): Promise<InvoiceLookup | undefined> {
  const manifest = getManifest('invoices');
  const states = opts.states ?? (await loadModuleStates(visibleManifests, opts.database));
  if (!manifest || !states.invoices) return undefined;
  const repo = createCollectionRepo(manifest, 'invoice', opts.database);
  const rows = (await repo.active().toArray()) as Record<string, unknown>[];
  const all = rows.map((r) => {
    return {
      id: String(r.id),
      payee: String(r.payee ?? ''),
      dueDate: String(r.dueDate ?? ''),
      restMinor: openRest(r),
      reference: typeof r.reference === 'string' ? r.reference : '',
      status: r.status,
      paidAt: typeof r.paidAt === 'string' ? r.paidAt : '',
    };
  });
  const open = all.filter((r) => r.status !== 'paid' && r.restMinor > 0);
  const strip = ({
    reference: _r,
    status: _s,
    paidAt: _p,
    ...inv
  }: (typeof open)[number]): OpenInvoice => {
    void _r;
    void _s;
    void _p;
    return inv;
  };

  // 1. A reference or invoice number typed in the line.
  const line = compact(fields.title);
  const byRef = open.filter(
    (r) => compact(r.reference).length >= 4 && line.includes(compact(r.reference)),
  );
  if (byRef.length === 1) return { match: strip(byRef[0]!) };

  // 2. The payee by name prefix, with an amount that covers the rest (plus a fee).
  const query = words(fields.title).filter((w) => !NOISE.has(w) && !/^\d/.test(w));
  const amount = fields.amountMinor;
  const named = (r: (typeof all)[number]) => names(r.payee).some((n) => namesPayee(query, n));
  const fits = open.filter((r) => {
    if (!named(r)) return false;
    if (amount === undefined) return true;
    return (
      amount >= r.restMinor && amount <= r.restMinor + Math.max(FEE_MINOR, r.restMinor * FEE_SHARE)
    );
  });
  if (fits.length === 0) {
    // The payee is known – an amount outside the window (an unrecorded part payment, interest) or a
    // reminder that crossed with the payment: unsure, so a ToDo to check, never a second invoice.
    // A paid one counts only when paid shortly before the reminder (they crossed); old history does not.
    const since = addDaysStr(fields.dunning?.date ?? opts.today, -CROSSED_DAYS);
    const known = all.filter(
      (r) => named(r) && (r.status !== 'paid' || (r.paidAt !== '' && r.paidAt >= since)),
    );
    return known.length > 0 ? { candidates: open.filter(named).map(strip) } : undefined;
  }
  if (fits.length === 1) return { match: strip(fits[0]!) };

  // 3. The oldest overdue one; a tie stays a question for later, never a guess.
  const overdue = fits.filter((r) => r.dueDate < opts.today);
  const pool = overdue.length > 0 ? overdue : fits;
  const oldest = pool.reduce((a, b) => (b.dueDate < a ? b.dueDate : a), pool[0]!.dueDate);
  const best = pool.filter((r) => r.dueDate === oldest);
  return best.length === 1 ? { match: strip(best[0]!) } : { candidates: pool.map(strip) };
}
