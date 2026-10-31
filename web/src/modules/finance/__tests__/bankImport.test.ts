// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { decodeTextBytes } from '@/core/io/pickFile';
import { commitImport } from '@/core/importer/batches';
import { buildPreview } from '@/core/importer/plan';
import type { ImportInput, ImportParseResult } from '@/core/importer/types';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';

import { accountRepo, categoryRepo, transactionRepo } from '../repo';
import { ColumnMapping } from '../components/ColumnMapping';
import { BANK_MAPPINGS_KEY } from '../bankMemory';
import { BANK_RULES_KEY, loadRules } from '../rulesStore';

const fixture = (name: string) =>
  decodeTextBytes(readFileSync(resolve(process.cwd(), 'src/core/io/__fixtures__/bank', name)));

const manifest = getManifest('finance')!;
const file = (text: string, extras?: Record<string, string>): ImportInput => ({
  kind: 'file',
  text,
  fileName: 'umsaetze',
  ...(extras ? { extras } : {}),
});

async function parse(input: ImportInput, accountId: string) {
  const runtime = (await manifest.contributions!.onboarding!.load!()).default;
  const result: ImportParseResult = await runtime.parse('bank', input, {
    today: '2026-10-31',
    options: { accountId },
    batchId: 'tb',
  });
  const rows = await buildPreview(manifest, runtime, result.candidates);
  return { result, rows };
}

async function importAll(input: ImportInput, accountId: string) {
  const { rows } = await parse(input, accountId);
  await commitImport(manifest, { batchId: 'tb', importerId: 'bank', source: 'f', rows });
  return rows;
}

let account: string;
beforeEach(async () => {
  setNow(() => new Date(2026, 9, 31, 10, 0).getTime());
  for (const c of ['account', 'category', 'transaction']) await db.table(`finance_${c}`).clear();
  await db.table('subscriptions_subscription').clear();
  await db.table('_imports').clear();
  await db.table('_meta').bulkDelete([BANK_MAPPINGS_KEY, BANK_RULES_KEY]);
  account = (await accountRepo.create({ name: 'Giro', openingBalanceMinor: 0, order: 0 })).id;
});
afterEach(() => setNow());

describe('the same file twice', () => {
  it.each(['sample-sgml.ofx', 'sample-de.qif', 'sparkasse-camt.csv', 'ing.csv'])(
    '%s: the second import has 0 new bookings',
    async (name) => {
      const text = fixture(name);
      const first = await importAll(file(text), account);
      const stored = await transactionRepo.active().count();
      expect(stored).toBe(first.filter((r) => r.selected).length);
      expect(stored).toBeGreaterThan(0);
      const second = await parse(file(text), account);
      expect(second.rows.filter((r) => !r.duplicate)).toHaveLength(0);
      expect(second.rows.every((r) => !r.selected)).toBe(true);
    },
  );

  it('keeps two coffees of one day but drops the FITID repeated inside one file', async () => {
    const { rows } = await parse(file(fixture('sample-sgml.ofx')), account);
    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.candidate.label.startsWith('Bäckerei'))).toHaveLength(2);
    expect(rows.every((r) => r.selected && !r.duplicate)).toBe(true);
  });
});

describe('what the preview says about the file', () => {
  it('names the recognised bank and format', async () => {
    const dkb = await parse(file(fixture('dkb-neu.csv')), account);
    expect(dkb.result.notes[0]).toBe('Erkannt: DKB');
    expect(dkb.rows).toHaveLength(3); // the pending row is not imported
    expect((await parse(file(fixture('sample-sgml.ofx')), account)).result.notes[0]).toBe(
      'Erkannt: OFX',
    );
    expect((await parse(file(fixture('sample-de.qif')), account)).result.notes[0]).toBe(
      'Erkannt: QIF',
    );
  });

  it('books only on an account of the same currency and says so calmly', async () => {
    const xml = fixture('sample-xml.ofx'); // USD
    const eur = await parse(file(xml), account);
    expect(eur.rows).toHaveLength(0);
    expect(eur.result.notes.join(' ')).toContain('USD');
    const usd = (
      await accountRepo.create({
        name: 'Dollar',
        openingBalanceMinor: 0,
        order: 1,
        currency: 'USD',
      })
    ).id;
    const ok = await parse(file(xml), usd);
    expect(ok.rows).toHaveLength(2);
    expect(ok.rows[0]!.candidate.data).toMatchObject({ amountMinor: 125000, kind: 'expense' });
  });

  it('a QIF file has no currency and goes to any account', async () => {
    const usd = (
      await accountRepo.create({
        name: 'Dollar',
        openingBalanceMinor: 0,
        order: 1,
        currency: 'USD',
      })
    ).id;
    expect((await parse(file(fixture('sample-us.qif')), usd)).rows).toHaveLength(3);
  });
});

const UNKNOWN = [
  'Tag;Summe;Wer;Wofuer',
  '01.10.2026;-12,50;Kiosk Eck;Zeitung',
  '02.10.2026;-3,00;Kiosk Eck;Brezel',
  '03.10.2026;100,00;Oma;Geschenk',
].join('\n');

describe('a CSV layout nobody knows', () => {
  it('asks once, then reads the same layout silently and finds everything again', async () => {
    const first = await parse(file(UNKNOWN), account);
    expect(first.rows).toHaveLength(0);
    expect(first.result.slot?.placement).toBe('resolve');

    // The dialog guesses date and amount; the user adds payee and purpose.
    let answer: Record<string, string> | undefined;
    const Panel = first.result.slot!.Panel;
    render(
      createElement(Panel, {
        busy: false,
        rows: [],
        onChange: () => {},
        submit: (e) => (answer = e),
      }),
    );
    expect(screen.getByLabelText('Datum')).toHaveValue('tag');
    expect(screen.getByLabelText('Betrag')).toHaveValue('summe');
    fireEvent.change(screen.getByLabelText('Empfänger (optional)'), { target: { value: 'wer' } });
    fireEvent.change(screen.getByLabelText('Verwendungszweck (optional)'), {
      target: { value: 'wofuer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Spalten übernehmen' }));
    expect(answer?.mapping).toBeTruthy();

    const mapped = await parse(file(UNKNOWN, answer), account);
    expect(mapped.rows).toHaveLength(3);
    expect(mapped.rows[0]!.candidate.data).toMatchObject({ payee: 'Kiosk Eck', note: 'Zeitung' });
    await commitImport(manifest, {
      batchId: 'tb',
      importerId: 'bank',
      source: 'f',
      rows: mapped.rows,
    });

    // Next time: no question, and the stored bookings are all recognised.
    const again = await parse(file(UNKNOWN), account);
    expect(again.result.slot).toBeUndefined();
    expect(again.result.notes[0]).toContain('gemerkte');
    expect(again.rows).toHaveLength(3);
    expect(again.rows.every((r) => r.duplicate)).toBe(true);
  });

  it('a wrong assignment is not remembered', async () => {
    const m = JSON.stringify({ date: 'wer', amount: 'summe', delimiter: ';' });
    const bad = await parse(file(UNKNOWN, { mapping: m }), account);
    expect(bad.rows).toHaveLength(0);
    expect((await db.table('_meta').get(BANK_MAPPINGS_KEY))?.value).toBeUndefined();
  });

  it('ColumnMapping needs a date and an amount before it continues', () => {
    const inspection = {
      header: ['A', 'B'],
      keys: ['a', 'b'],
      sample: [['x', 'y']],
      delimiter: ';' as const,
      signature: 's',
    };
    render(createElement(ColumnMapping, { inspection, busy: false, onSubmit: () => {} }));
    expect(screen.getByRole('button', { name: 'Spalten übernehmen' })).toBeDisabled();
  });
});

describe('rules from suggestions', () => {
  const NETFLIX =
    'Buchungstag;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Betrag;Waehrung\n01.10.2026;Monatsbeitrag;Netflix International B.V.;-12,99;EUR\n';
  const NETFLIX_NEXT =
    'Buchungstag;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Betrag;Waehrung\n01.11.2026;Monatsbeitrag;NETFLIX INTERNATIONAL B.V.;-12,99;EUR\n';

  async function render1(
    result: ImportParseResult,
    rows: Awaited<ReturnType<typeof parse>>['rows'],
  ) {
    const Panel = result.slot!.Panel;
    let current = rows;
    render(
      createElement(Panel, { busy: false, rows, onChange: (r) => (current = r), submit: () => {} }),
    );
    return () => current;
  }

  it('suggests, creates the rule only on confirmation, and categorises the next import by itself', async () => {
    await categoryRepo.create({ name: 'Abos', kind: 'expense' }, { id: 'cat-subs' });
    // The subscription belongs to another module: written the way the module's repo stores it.
    const sub = { id: 'sub-netflix' };
    await db.table('subscriptions_subscription').put({
      id: sub.id,
      name: 'Netflix',
      amountMinor: 1299,
      recurrence: { freq: 'monthly', interval: 1 },
      startDate: '2026-09-01',
      active: true,
      createdAt: 0,
      updatedAt: 0,
      deviceId: 'test',
      deletedAt: null,
      _f: {},
    });
    const first = await parse(file(NETFLIX), account);
    expect(first.result.slot?.placement).toBe('preview');
    expect(first.rows[0]!.candidate.warning).toBeUndefined();
    expect(first.rows[0]!.candidate.data).not.toHaveProperty('categoryId');

    const current = await render1(first.result, first.rows);
    const box = screen.getByRole('checkbox');
    expect(box).not.toBeChecked(); // never ticked for the user
    expect(await loadRules()).toEqual([]); // nothing created yet
    fireEvent.click(box);
    // The effect is visible in the row at once …
    expect(current()[0]!.candidate.data).toMatchObject({
      categoryId: 'cat-subs',
      sourceRef: `subscription:${sub.id}`,
    });
    expect(current()[0]!.candidate.warning).toContain('Regel');
    // … but the rule exists only once the import is confirmed.
    expect(await loadRules()).toEqual([]);
    await first.result.slot!.onCommitted!(current());
    expect((await loadRules()).map((r) => r.match)).toEqual(['netflix']);

    const second = await parse(file(NETFLIX_NEXT), account);
    expect(second.result.slot).toBeUndefined(); // known now: no question
    expect(second.rows[0]!.candidate.data).toMatchObject({
      categoryId: 'cat-subs',
      sourceRef: `subscription:${sub.id}`,
    });
    expect(second.rows[0]!.candidate.warning).toContain('Netflix');
  });

  it('an unticked suggestion creates nothing', async () => {
    await categoryRepo.create({ name: 'Abos', kind: 'expense' }, { id: 'cat-subs' });
    const first = await parse(file(NETFLIX), account);
    expect(first.result.slot).toBeDefined(); // provider name from the shipped list
    await first.result.slot!.onCommitted!(first.rows);
    expect(await loadRules()).toEqual([]);
  });
});
