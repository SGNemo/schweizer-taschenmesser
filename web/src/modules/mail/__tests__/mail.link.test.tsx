// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { enableModule } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import type { MailAccountRef, MailMessage } from '@/core/mail/types';
import { setNow } from '@/core/time/now';

const LINK = 'https://mail.google.com/mail/?authuser=me%40example.org#all/t1';
const account: MailAccountRef = { key: 'google', connectorId: 'google', email: 'me@example.org' };
const threadMock = vi.fn();

vi.mock('@/core/mail/service', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  mailThread: (...a: unknown[]) => threadMock(...a),
  mailAttachment: vi.fn(),
  mailWebUrl: (ref: MailAccountRef) => (ref.key === 'demo' ? undefined : LINK),
}));

import { ThreadView } from '../components/ThreadView';
import { loadThreadBodies } from '../cache';
import { invoiceMailId } from '../invoiceRow';
import { linkRepo } from '../repo';
import { useUiStore } from '@/stores/ui';

const message: MailMessage = {
  id: 'm1',
  threadId: 't1',
  from: { name: 'Stadtwerke Musterstadt', email: 'rechnung@stadtwerke.example.org' },
  to: [{ email: 'me@example.org' }],
  cc: [],
  subject: 'Ihre Rechnung für Oktober',
  date: new Date(2026, 9, 28, 8, 15).getTime(),
  labelIds: ['INBOX'],
  unread: true,
  text: 'Guten Tag, Ihre Rechnung über 84,30 EUR ist fällig am 15.11. Bitte überweisen Sie den Betrag.',
  attachments: [],
  inline: [],
};

const view = (acc: MailAccountRef = account) =>
  render(
    <MemoryRouter>
      <ThreadView
        account={acc}
        threadId="t1"
        cacheBodies={false}
        autoLoadImages={false}
        labels={[]}
        confirmMoves
        onChanged={() => undefined}
        onCompose={() => undefined}
        onBack={() => undefined}
      />
    </MemoryRouter>,
  );

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: 'Aus dieser Mail anlegen' }));
};

beforeEach(async () => {
  setNow(() => new Date(2026, 9, 29, 10, 0).getTime());
  await clearAll();
  await db.table('mail_link').clear();
  await db.table('invoices_invoice').clear();
  await db.table('notes_note').clear();
  threadMock.mockReset().mockResolvedValue({ id: 't1', messages: [message] });
  await enableModule(getManifest('invoices')!);
});
afterEach(() => setNow());

describe('create from this mail', () => {
  it('offers only the destinations whose module is on', async () => {
    const user = userEvent.setup();
    view();
    await openMenu(user);
    const items = (await screen.findAllByRole('menuitem')).map((i) => i.textContent);
    expect(items).toEqual(['Rechnung', 'Termin', 'ToDo', 'Erinnerung']); // bookmarks and notes are off
  });

  it('prefills an invoice from the mail, saves nothing until confirmed, then links both ways', async () => {
    const user = userEvent.setup();
    view();
    await openMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Rechnung' }));

    const dialog = await screen.findByRole('dialog');
    const field = within(dialog).getByRole('textbox');
    expect(field).toHaveValue('Stadtwerke Musterstadt 84,30 € 15.11.2026');
    expect(within(dialog).getByText(/ein Link zu dieser Mail/)).toBeInTheDocument();
    // the preview is shown, nothing is stored yet
    // The chips render first and are filled once the line is read: wait for the content, not the box.
    await waitFor(() =>
      expect(within(dialog).getByTestId('capture-chips')).toHaveTextContent('84,30'),
    );
    expect(await db.table('invoices_invoice').count()).toBe(0);
    expect(await db.table('mail_link').count()).toBe(0);

    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(async () => expect(await db.table('invoices_invoice').count()).toBe(1));
    const [invoice] = await db.table('invoices_invoice').toArray();
    expect(invoice).toMatchObject({
      payee: 'Stadtwerke Musterstadt',
      amountMinor: 8430,
      dueDate: '2026-11-15',
      status: 'open',
      note: LINK, // the link to the mail is in the entry
    });

    // and the way back: the thread lists what came out of it
    const back = await screen.findByTestId('mail-linked');
    expect(
      within(back).getByRole('link', { name: /Rechnung „Stadtwerke Musterstadt“ öffnen/ }),
    ).toHaveAttribute('href', '/invoices');
    const [row] = await db.table('mail_link').toArray();
    expect(row).toMatchObject({
      accountKey: 'google',
      threadId: 't1',
      messageId: 'm1',
      type: 'invoice',
      moduleId: 'invoices',
    });
  });

  it('the sheet saves an invoice under the id the mail list uses; a second save finds it (Nachlese)', async () => {
    const user = userEvent.setup();
    view();
    await openMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Rechnung' }));
    let dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(dialog).getByTestId('capture-chips')).toHaveTextContent('84,30'),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(async () => expect(await db.table('invoices_invoice').count()).toBe(1));
    const [invoice] = await db.table('invoices_invoice').toArray();
    expect(invoice.id).toBe(await invoiceMailId('m1'));
    // The same message through the sheet again: no second invoice.
    await openMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Rechnung' }));
    dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(dialog).getByTestId('capture-chips')).toHaveTextContent('84,30'),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(useUiStore.getState().toasts.at(-1)?.message).toBe('Schon angelegt'),
    );
    expect(await db.table('invoices_invoice').count()).toBe(1);
  });

  it('a deleted invoice under the mail id never comes back with old values: the sheet saves its own', async () => {
    const id = await invoiceMailId('m1');
    await db.table('invoices_invoice').add({
      id,
      payee: 'Alt',
      amountMinor: 100,
      dueDate: '2026-01-01',
      status: 'open',
      createdAt: 1,
      updatedAt: 1,
      deviceId: 'd',
      deletedAt: 2,
      _f: {},
    });
    const user = userEvent.setup();
    view();
    await openMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Rechnung' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(dialog).getByTestId('capture-chips')).toHaveTextContent('84,30'),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    const live = async () =>
      (await db.table('invoices_invoice').toArray()).filter((r) => !r.deletedAt);
    await waitFor(async () => expect(await live()).toHaveLength(1));
    const [created] = await live();
    expect(created).toMatchObject({ payee: 'Stadtwerke Musterstadt', amountMinor: 8430 });
    expect(created.id).not.toBe(id);
    expect((await db.table('invoices_invoice').get(id)).deletedAt).not.toBeNull();
  });

  it('cancelling saves nothing', async () => {
    const user = userEvent.setup();
    view();
    await openMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'ToDo' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await db.table('todos_task').count()).toBe(0);
    expect(await db.table('mail_link').count()).toBe(0);
  });

  it('forgets the link when the entry is deleted', async () => {
    const user = userEvent.setup();
    view();
    await openMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Rechnung' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Speichern' }),
    );
    await screen.findByTestId('mail-linked');
    const repo = createCollectionRepo(getManifest('invoices')!, 'invoice');
    const [invoice] = await db.table('invoices_invoice').toArray();
    await repo.remove(invoice!.id);
    await waitFor(() => expect(screen.queryByTestId('mail-linked')).toBeNull());
    await waitFor(async () => expect(await linkRepo.active().count()).toBe(0));
  });

  it('a note takes the start of the mail only when asked, with the link', async () => {
    await enableModule(getManifest('notes')!);
    const user = userEvent.setup();
    view();
    await openMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Notiz' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(async () => expect(await db.table('notes_note').count()).toBe(1));
    const [plain] = await db.table('notes_note').toArray();
    expect(plain!.body).toBe(LINK);
    expect(plain!.body).not.toContain('Guten Tag');
  });

  it('sample mail stores no link', async () => {
    await db.table('mail_body').clear();
    await db.table('mail_body').put({
      id: 'demo|m1',
      accountKey: 'demo',
      messageId: 'm1',
      threadId: 't1',
      sortKey: 1,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 'x',
      deletedAt: null,
      _f: {},
      demo: {
        from: message.from,
        to: message.to,
        subject: message.subject,
        date: message.date,
        text: message.text,
      },
    });
    expect(await loadThreadBodies('demo', 't1')).toHaveLength(1);
    const user = userEvent.setup();
    view({ key: 'demo', connectorId: 'demo' });
    await openMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Rechnung' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/Beispiel-Mail: es wird kein Link gespeichert/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(async () => expect(await db.table('invoices_invoice').count()).toBe(1));
    expect('note' in (await db.table('invoices_invoice').toArray())[0]!).toBe(false);
  });
});
