// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { disableModule, enableModule } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { patchFocusSettings } from '@/core/settings/focus';
import { setNow } from '@/core/time/now';
import { t } from '@/strings';
import { Dialog } from '@/ui';
import type { SavedCapture } from '../targets';
import { CaptureForm } from './CaptureForm';

// The form tests render a lot of UI; on a loaded CI runner the default 5 s is too tight.
vi.setConfig({ testTimeout: 20_000 });

// Wednesday, 2026-09-30, 10:00. Todos, calendar and finance are on by default.
beforeEach(async () => {
  setNow(() => new Date(2026, 8, 30, 10, 0).getTime());
  localStorage.clear();
  await clearAll();
});
afterEach(() => setNow());

const box = () => screen.findByRole('textbox', { name: t.quickCapture.inputLabel });
/** The target of each row, as the row says it (text, no select in the first view). */
const rowTypes = () =>
  screen.getAllByTestId('capture-row-target').map((b) => b.getAttribute('data-type'));
/** A tap on a row's target text opens its choice. */
async function pickTarget(user: ReturnType<typeof userEvent.setup>, row: number, type: string) {
  await user.click(screen.getAllByTestId('capture-row-target')[row]!);
  await user.selectOptions(await screen.findByTestId('capture-row-type'), type);
}
const chips = () => screen.getByTestId('capture-chips');

describe('CaptureForm', () => {
  it('shows a live preview and saves an appointment with Enter', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(await box(), 'morgen 15 Uhr Zahnarzt');
    await waitFor(() => expect(chips()).toHaveTextContent('Ziel: Kalender'));
    expect(chips()).toHaveTextContent('Morgen, 1. Okt');
    expect(chips()).toHaveTextContent('15:00 Uhr');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [event] = await db.table('calendar_event').toArray();
    expect(event).toMatchObject({ title: 'Zahnarzt', startDate: '2026-10-01', startTime: '15:00' });
  });

  it('lets ArrowDown switch the type before saving', async () => {
    const user = userEvent.setup();
    render(<CaptureForm onSaved={() => undefined} />);
    await user.type(await box(), 'Blumen gießen');
    await waitFor(() => expect(chips()).toHaveTextContent('Ziel: ToDos'));
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(chips()).toHaveTextContent('Ziel: Kalender'));
    await user.keyboard('{Enter}');
    await waitFor(async () => expect(await db.table('calendar_event').count()).toBe(1));
    expect(await db.table('todos_task').count()).toBe(0);
  });

  it('asks instead of guessing on a low-confidence input when "Ohne Rückfrage" is off, and does not save', async () => {
    await patchFocusSettings({ captureNoQuestion: false });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(await box(), 'Zahnarzt morgen 15 Uhr 80 €');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(t.quickCapture.chooseType);
    expect(onSaved).not.toHaveBeenCalled();
    await user.click(screen.getByRole('radio', { name: t.quickCapture.type.event }));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('books finance only after an explicit confirmation', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(await box(), '$ 12,50 Mittagessen{Enter}');
    expect(await screen.findByTestId('capture-draft')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(await db.table('finance_transaction').count()).toBe(0);
    await user.click(screen.getByRole('button', { name: t.quickCapture.book }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [tx] = await db.table('finance_transaction').toArray();
    expect(tx).toMatchObject({ amountMinor: 1250, kind: 'expense', payee: 'Mittagessen' });
  });

  it('asks to book only a complete entry: "$ " alone is incomplete (X33)', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(await box(), '$ {Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(t.quickCapture.errors.invalid);
    expect(screen.queryByTestId('capture-draft')).not.toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('shows a foreign amount and sends it to the full form instead of the euro account (X21)', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(await box(), 'Ausgabe 12 USD Kaffee');
    await waitFor(() => expect(chips()).toHaveTextContent(t.quickCapture.chip.currency('USD')));
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.quickCapture.errors.currency('USD'),
    );
    expect(screen.queryByTestId('capture-draft')).not.toBeInTheDocument();
    expect(await db.table('finance_transaction').count()).toBe(0);
  });

  it('closes with Escape', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<CaptureForm onSaved={() => undefined} onCancel={onCancel} />);
    await user.type(await box(), 'x{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('Tab switches the type in the capture window', async () => {
    const user = userEvent.setup();
    render(<CaptureForm tabSwitchesType onSaved={() => undefined} />);
    await user.type(await box(), 'Blumen gießen');
    await waitFor(() => expect(chips()).toHaveTextContent('Ziel: ToDos'));
    await user.tab();
    await waitFor(() => expect(chips()).toHaveTextContent('Ziel: Kalender'));
    expect(await box()).toHaveFocus();
  });

  it('flags assumptions instead of hiding them', async () => {
    const user = userEvent.setup();
    render(<CaptureForm onSaved={() => undefined} />);
    await user.type(await box(), '15 Uhr Zahnarzt');
    await waitFor(() => expect(chips()).toHaveTextContent(t.quickCapture.chip.assumedDate));
  });

  it('a date that does not exist is shown and blocks saving instead of a silent today (X20)', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(await box(), 'Zahnarzt 31.11. 10 Uhr');
    await waitFor(() => expect(chips()).toHaveTextContent(t.quickCapture.chip.invalidDate));
    expect(chips()).not.toHaveTextContent(t.quickCapture.chip.assumedDate);
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(t.quickCapture.errors.invalid);
    expect(onSaved).not.toHaveBeenCalled();
    expect(await db.table('calendar_event').count()).toBe(0);
  });

  it('without the question: unclear text is saved as typed in the ToDo inbox', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(await box(), 'Zahnarzt morgen 15 Uhr 80 €');
    expect(await screen.findByTestId('capture-inbox-hint')).toHaveTextContent('Landet in „ToDos“');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [task] = await db.table('todos_task').toArray();
    expect(task).toMatchObject({ title: 'Zahnarzt morgen 15 Uhr 80 €', listId: 'inbox' });
    expect(await db.table('calendar_event').count()).toBe(0);
    expect(await db.table('finance_transaction').count()).toBe(0);
  });

  it('Ctrl+Enter opens the full form pre-filled instead of saving', async () => {
    const user = userEvent.setup();
    const onOpenFull = vi.fn();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} onOpenFull={onOpenFull} />);
    await user.type(await box(), 'Blumen gießen');
    await waitFor(() => expect(chips()).toHaveTextContent('Ziel: ToDos'));
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(onOpenFull).toHaveBeenCalledWith('/todos?new=1&title=Blumen%20gie%C3%9Fen');
    expect(onSaved).not.toHaveBeenCalled();
    expect(await db.table('todos_task').count()).toBe(0);
  });

  it('Ctrl+Enter just saves where no full form can be pre-filled', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} onOpenFull={() => undefined} />);
    await user.type(await box(), 'morgen 15 Uhr Zahnarzt');
    await waitFor(() => expect(chips()).toHaveTextContent('Ziel: Kalender'));
    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('one line is read exactly as before: no preview rows, same chips', async () => {
    const user = userEvent.setup();
    render(<CaptureForm onSaved={() => undefined} />);
    await user.type(await box(), 'Statistik Vorlesung Mo und Mi 10 bis 12 Uhr');
    await waitFor(() => expect(chips()).toHaveTextContent('Ziel: Kalender'));
    expect(screen.queryByTestId('capture-rows')).toBeNull();
  });

  it('two lines: two rows with their own target, one click saves both, undo takes both back', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(await box(), 'Milch kaufen{Shift>}{Enter}{/Shift}morgen 15 Uhr Zahnarzt');
    const rows = await screen.findAllByTestId('capture-row');
    expect(rows).toHaveLength(2);
    expect(rowTypes()).toEqual(['todo', 'event']);
    // The first view has no select: the target is text („Termin · …“), a tap opens the choice.
    expect(screen.queryByTestId('capture-row-type')).toBeNull();
    expect(rows[1]).toHaveTextContent(t.quickCapture.type.event);
    expect(rows[1]).toHaveTextContent('Morgen, 1. Okt');
    expect(rows[1]).toHaveTextContent('15:00 Uhr');
    // No type radios in the list view: each row has its own menu.
    expect(screen.queryByRole('radio')).toBeNull();
    await user.click(screen.getByRole('button', { name: t.quickCapture.multi.saveAll(2) }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const saved = onSaved.mock.calls[0]![0] as SavedCapture;
    expect(saved.count).toBe(2);
    expect(await db.table('todos_task').count()).toBe(1);
    const [event] = await db.table('calendar_event').toArray();
    expect(event).toMatchObject({ title: 'Zahnarzt', startDate: '2026-10-01', startTime: '15:00' });
    await saved.undo();
    expect((await db.table('todos_task').toArray())[0]?.deletedAt).toBeTruthy();
    expect((await db.table('calendar_event').toArray())[0]?.deletedAt).toBeTruthy();
  });

  it('a row target changes through its menu', async () => {
    const user = userEvent.setup();
    render(<CaptureForm onSaved={() => undefined} />);
    await user.type(await box(), 'Milch kaufen, Oma anrufen');
    await screen.findAllByTestId('capture-row-target');
    await pickTarget(user, 1, 'reminder');
    await user.click(screen.getByRole('button', { name: t.quickCapture.multi.saveAll(2) }));
    await waitFor(async () => expect(await db.table('todos_task').count()).toBe(1));
    const [reminder] = await db.table('calendar_event').toArray();
    expect(reminder).toMatchObject({ title: 'Oma anrufen', kind: 'reminder' });
  });

  it('unclear rows land in the inbox as typed; a batch never books (one tap, a `$` line becomes a ToDo)', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(
      await box(),
      'Zahnarzt morgen 15 Uhr 80 €{Shift>}{Enter}{/Shift}$ 12,50 Mittagessen',
    );
    const rows = await screen.findAllByTestId('capture-row');
    expect(rows[0]).toHaveTextContent(t.quickCapture.multi.inbox);
    // The money line offers to be booked on its own; the batch target list has no booking.
    expect(screen.getByTestId('capture-row-book')).toHaveTextContent(
      t.quickCapture.multi.bookExpense,
    );
    await user.click(screen.getAllByTestId('capture-row-target')[1]!);
    const select = await screen.findByTestId('capture-row-type');
    expect(Array.from((select as HTMLSelectElement).options).map((o) => o.value)).not.toContain(
      'finance',
    );
    await user.click(await box());
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(screen.queryByTestId('capture-draft')).toBeNull();
    const tasks = await db.table('todos_task').toArray();
    const titles = tasks.map((x) => String(x.title).replace(/\s/g, ' ')).sort();
    expect(titles).toEqual(['Mittagessen · 12,50 €', 'Zahnarzt morgen 15 Uhr 80 €']);
    expect(await db.table('finance_transaction').count()).toBe(0);
  });

  it('„Als Ausgabe buchen“ opens the single sheet with the line; booked, it leaves the batch', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(
      await box(),
      'Müll runterbringen{Shift>}{Enter}{/Shift}Mittagessen 12,50 € ausgegeben',
    );
    await user.click(await screen.findByTestId('capture-row-book'));
    const sheet = await screen.findByRole('dialog', { name: t.quickCapture.multi.bookExpense });
    const inner = (await screen.findAllByRole('textbox', { name: t.quickCapture.inputLabel })).at(
      -1,
    )! as HTMLTextAreaElement;
    expect(inner.value).toBe('Mittagessen 12,50 € ausgegeben');
    // The single sheet keeps the draft and „Buchen“.
    await user.click(within(sheet).getByRole('button', { name: t.quickCapture.save }));
    await user.click(await within(sheet).findByRole('button', { name: t.quickCapture.book }));
    await waitFor(async () => expect(await db.table('finance_transaction').count()).toBe(1));
    const outer = (await screen.findAllByRole('textbox', { name: t.quickCapture.inputLabel }))[0]!;
    await waitFor(() => expect((outer as HTMLTextAreaElement).value).toBe('Müll runterbringen'));
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('shared text (`oneEntry`) is one entry, never split', async () => {
    render(
      <CaptureForm
        oneEntry
        initialText={'Hallo, kannst du das prüfen\nund mir sagen'}
        onSaved={() => undefined}
      />,
    );
    await box();
    expect(screen.queryByTestId('capture-rows')).toBeNull();
    expect(screen.getByTestId('capture-chips')).toBeInTheDocument();
  });

  it('with "Ohne Rückfrage" off, an unclear row must be chosen first', async () => {
    await patchFocusSettings({ captureNoQuestion: false });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(await box(), 'Milch kaufen{Shift>}{Enter}{/Shift}Zahnarzt morgen 15 Uhr 80 €');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(t.quickCapture.chooseType);
    expect(onSaved).not.toHaveBeenCalled();
    await pickTarget(user, 1, 'event');
    await user.click(screen.getByRole('button', { name: t.quickCapture.multi.saveAll(2) }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(await db.table('calendar_event').count()).toBe(1);
  });

  it('shared text with several lines becomes several entries without the shared note on each', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <CaptureForm
        initialText={'Milch kaufen\nOma anrufen'}
        extra={{ note: 'Milch kaufen\nOma anrufen' }}
        onSaved={onSaved}
      />,
    );
    expect(await screen.findAllByTestId('capture-row')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: t.quickCapture.multi.saveAll(2) }));
    // Two entries are written to IndexedDB one after the other: on a loaded CI runner that took 1.03 s, just
    // over the 1 s default of waitFor (the assertion itself is unchanged).
    await waitFor(() => expect(onSaved).toHaveBeenCalled(), { timeout: 5000 });
    const tasks = await db.table('todos_task').toArray();
    expect(tasks.map((x) => x.title).sort()).toEqual(['Milch kaufen', 'Oma anrufen']);
    expect(tasks.every((x) => !x.notes)).toBe(true);
  });

  describe('C04: typed text survives the app being killed in the background', () => {
    it('restores the text in a fresh form when the old one never closed', async () => {
      const user = userEvent.setup();
      render(<CaptureForm keepDraft onSaved={() => undefined} />);
      await user.type(await box(), 'Bremsen prüfen morgen');
      // A killed app never unmounts: the next start renders a new form next to nothing.
      render(<CaptureForm keepDraft onSaved={() => undefined} />);
      const boxes = await screen.findAllByRole('textbox', { name: t.quickCapture.inputLabel });
      expect(boxes.at(-1)).toHaveValue('Bremsen prüfen morgen');
    });

    it('forgets the text once the sheet was closed or the entry saved', async () => {
      const user = userEvent.setup();
      const first = render(<CaptureForm keepDraft onSaved={() => undefined} />);
      await user.type(await box(), 'Weg damit');
      first.unmount();
      const second = render(<CaptureForm keepDraft onSaved={() => undefined} />);
      expect(await box()).toHaveValue('');
      await user.type(await box(), 'Ölwechsel');
      await user.keyboard('{Enter}');
      await waitFor(async () => expect(await db.table('todos_task').count()).toBe(1));
      second.unmount();
      render(<CaptureForm keepDraft onSaved={() => undefined} />);
      expect(await box()).toHaveValue('');
    });

    it('drops a draft older than 30 minutes', async () => {
      const user = userEvent.setup();
      render(<CaptureForm keepDraft onSaved={() => undefined} />);
      await user.type(await box(), 'Alt');
      setNow(() => new Date(2026, 8, 30, 10, 31).getTime());
      render(<CaptureForm keepDraft onSaved={() => undefined} />);
      const boxes = await screen.findAllByRole('textbox', { name: t.quickCapture.inputLabel });
      expect(boxes.at(-1)).toHaveValue('');
    });

    it('is off for the other capture places (share page, desktop window)', async () => {
      const user = userEvent.setup();
      render(<CaptureForm keepDraft onSaved={() => undefined} />);
      await user.type(await box(), 'Nur im Blatt');
      render(<CaptureForm onSaved={() => undefined} />);
      const boxes = await screen.findAllByRole('textbox', { name: t.quickCapture.inputLabel });
      expect(boxes.at(-1)).toHaveValue('');
    });
  });

  it('C08: typing the field example shows two rows: an expense and an appointment', async () => {
    const user = userEvent.setup();
    render(<CaptureForm onSaved={() => undefined} />);
    const example = /„(.+)“/.exec(t.quickCapture.placeholder)?.[1] ?? '';
    await user.type(await box(), example);
    const rows = await screen.findAllByTestId('capture-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Tanken');
    expect(rows[0]).toHaveTextContent('62,40');
    expect(rows[1]).toHaveTextContent('Kunde anrufen');
    expect(rows[1]).toHaveTextContent('09:00');
  });
});

describe('the booking sheet inside the capture sheet', () => {
  it('Esc in the booking sheet closes only that sheet, never the capture sheet around it', async () => {
    const user = userEvent.setup();
    const outerClose = vi.fn();
    render(
      <Dialog open onClose={outerClose} title="Schnell hinzufügen">
        <CaptureForm onSaved={() => undefined} />
      </Dialog>,
    );
    await user.type(await box(), 'Müll runterbringen{Shift>}{Enter}{/Shift}Brot gekauft 3,80 €');
    await user.click(await screen.findByTestId('capture-row-book'));
    const sheet = await screen.findByRole('dialog', { name: t.quickCapture.multi.bookExpense });
    fireEvent(sheet, new Event('cancel', { cancelable: true }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: t.quickCapture.multi.bookExpense })).toBeNull(),
    );
    expect(outerClose).not.toHaveBeenCalled();
  });
});

describe('payment reminders in a batch („Kopf leer“ package 2)', () => {
  const invoices = () =>
    createCollectionRepo(getManifest('invoices')!, 'invoice') as ReturnType<
      typeof createCollectionRepo
    >;
  const LINES = 'Müll runterbringen{Shift>}{Enter}{/Shift}Mahnung Stadtwerke 87,40 € zahlen';

  it('an open invoice: the line reads „Mahnung zu Rechnung …“ and is noted on it, never a second invoice', async () => {
    await enableModule(getManifest('invoices')!);
    await invoices().createMany([
      {
        id: 'inv-1',
        data: {
          payee: 'Stadtwerke Musterstadt',
          amountMinor: 8430,
          dueDate: '2026-09-15',
          status: 'open',
        },
      },
    ]);
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(await box(), LINES);
    const target = (await screen.findAllByTestId('capture-row-target'))[1]!;
    await waitFor(() =>
      expect(target).toHaveTextContent('Mahnung zu Rechnung Stadtwerke Musterstadt'),
    );
    // Nothing asks while unloading: no question mark, no select.
    expect(screen.getByTestId('capture-rows').textContent).not.toContain('?');
    await user.click(screen.getByRole('button', { name: t.quickCapture.multi.saveAll(2) }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const all = await db.table('invoices_invoice').toArray();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: 'inv-1', amountMinor: 8430, dunningLevel: 1 });
  });

  it('two equally good invoices: the line stays a ToDo „Mahnung … prüfen“', async () => {
    await enableModule(getManifest('invoices')!);
    for (const id of ['a', 'b'])
      await invoices().createMany([
        {
          id,
          data: { payee: 'Stadtwerke', amountMinor: 8430, dueDate: '2026-09-15', status: 'open' },
        },
      ]);
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(await box(), LINES);
    const target = (await screen.findAllByTestId('capture-row-target'))[1]!;
    await waitFor(() => expect(target).toHaveAttribute('data-type', 'todo'));
    await user.click(screen.getByRole('button', { name: t.quickCapture.multi.saveAll(2) }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const titles = (await db.table('todos_task').toArray()).map((x) => x.title).sort();
    expect(titles).toEqual(['Mahnung Stadtwerke prüfen', 'Müll runterbringen']);
    expect((await db.table('invoices_invoice').toArray()).every((x) => !x.dunningLevel)).toBe(true);
  });

  it('no open invoice: a new invoice at dunning level 1', async () => {
    await enableModule(getManifest('invoices')!);
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(await box(), LINES);
    const target = (await screen.findAllByTestId('capture-row-target'))[1]!;
    await waitFor(() => expect(target).toHaveAttribute('data-type', 'invoice'));
    await user.click(screen.getByRole('button', { name: t.quickCapture.multi.saveAll(2) }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [inv] = await db.table('invoices_invoice').toArray();
    expect(inv).toMatchObject({ payee: 'Stadtwerke', amountMinor: 8740, dunningLevel: 1 });
  });
});

describe('a target picked by hand is final (council round 3)', () => {
  it('another target picked by hand is final; re-picking „Rechnung“ keeps the check', async () => {
    await enableModule(getManifest('invoices')!);
    await createCollectionRepo(getManifest('invoices')!, 'invoice').createMany([
      {
        id: 'inv-1',
        data: { payee: 'Stadtwerke', amountMinor: 8430, dueDate: '2026-09-15', status: 'open' },
      },
    ]);
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(
      await box(),
      'Müll runterbringen{Shift>}{Enter}{/Shift}Mahnung Stadtwerke 87,40 €',
    );
    const target = () => screen.getAllByTestId('capture-row-target')[1]!;
    await waitFor(() => expect(target()).toHaveTextContent('Mahnung zu Rechnung'));
    // The read target again: still noted on the open invoice.
    await pickTarget(user, 1, 'invoice');
    await waitFor(() => expect(target()).toHaveTextContent('Mahnung zu Rechnung'));
    // Another target: final.
    await pickTarget(user, 1, 'reminder');
    await waitFor(() => expect(target()).toHaveAttribute('data-type', 'reminder'));
    await user.click(screen.getByRole('button', { name: t.quickCapture.multi.saveAll(2) }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(await db.table('invoices_invoice').count()).toBe(1);
    expect((await db.table('invoices_invoice').get('inv-1'))!.dunningLevel).toBeUndefined();
  });
});

describe('council round 4 – presets, ToDos off, moving lines', () => {
  const invoicesRepo = () => createCollectionRepo(getManifest('invoices')!, 'invoice');
  const open = (id: string) =>
    invoicesRepo().createMany([
      {
        id,
        data: { payee: 'Stadtwerke', amountMinor: 8430, dueDate: '2026-09-15', status: 'open' },
      },
    ]);

  it('a preset target (the mail dialog’s initialType) still looks for the open invoice', async () => {
    await enableModule(getManifest('invoices')!);
    await open('inv-1');
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <CaptureForm
        initialType="invoice"
        initialText="Mahnung Stadtwerke 87,40 €"
        onSaved={onSaved}
      />,
    );
    expect(await screen.findByTestId('capture-dunning-hint')).toHaveTextContent('Stadtwerke');
    await user.click(screen.getByRole('button', { name: t.quickCapture.save }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(await db.table('invoices_invoice').count()).toBe(1);
    expect((await db.table('invoices_invoice').get('inv-1'))!.dunningLevel).toBe(1);
  });

  it('ToDos off and unsure: the line says why and nothing is saved until a target is picked', async () => {
    await enableModule(getManifest('invoices')!);
    await disableModule(getManifest('todos')!, 'keep');
    await open('a');
    await open('b');
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(
      await box(),
      'Zahnarzt morgen 9 Uhr{Shift>}{Enter}{/Shift}Mahnung Stadtwerke 87,40 €',
    );
    const reason = t.quickCapture.multi.dunningChoose('Stadtwerke');
    await waitFor(() =>
      expect(screen.getAllByTestId('capture-row-target')[1]).toHaveTextContent(reason),
    );
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(reason);
    expect(onSaved).not.toHaveBeenCalled();
    expect((await db.table('invoices_invoice').toArray()).every((x) => !x.dunningLevel)).toBe(true);
  });
});
