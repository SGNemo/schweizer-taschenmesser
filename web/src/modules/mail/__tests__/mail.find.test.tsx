// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import type {
  MailAccountRef,
  MailMessage,
  MailPage as ThreadPage,
  MailThreadSummary,
} from '@/core/mail/types';
import { useUiStore } from '@/stores/ui';

const full: MailAccountRef = {
  key: 'google',
  connectorId: 'google',
  email: 'me@example.org',
  features: ['mail', 'mail-modify', 'mail-send'],
};
let accounts: MailAccountRef[] = [full];

const mocks = {
  threads: vi.fn<(ref: MailAccountRef, req: Record<string, unknown>) => Promise<ThreadPage>>(),
  thread: vi.fn(),
  modify: vi.fn(),
  trash: vi.fn(),
};
vi.mock('@/core/mail/accounts', () => ({ listMailAccounts: async () => accounts }));
vi.mock('@/core/mail/service', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  mailLabels: async () => [{ id: 'INBOX', name: 'INBOX', kind: 'system', unread: 1 }],
  mailThreads: (ref: MailAccountRef, req: Record<string, unknown>) => mocks.threads(ref, req),
  mailThread: (...a: unknown[]) => mocks.thread(...a),
  mailAttachment: vi.fn(),
  mailUnread: async () => 0,
  mailWebUrl: () => 'https://mail.google.com/mail/#all/t1',
  mailModify: (...a: unknown[]) => mocks.modify(...a),
  mailTrash: (...a: unknown[]) => mocks.trash(...a),
  mailDrafts: async () => [],
}));

import MailPage from '../routes/MailPage';
import { forgetSearch, hasFilter, readSaved, saveSearch, toggleFilter } from '../searchHistory';
import { mailKeyOf } from '../useMailKeys';
import { createShortcutHandler } from '@/core/keyboard/shortcuts';

const summary = (id: string, subject: string, labelIds = ['INBOX']): MailThreadSummary => ({
  id,
  messageCount: 1,
  from: { name: 'Stadtwerke', email: 'rechnung@example.org' },
  subject,
  snippet: 'Vorschau',
  date: Date.now(),
  unread: labelIds.includes('UNREAD'),
  labelIds,
  hasAttachment: false,
});

const message: MailMessage = {
  id: 'm1',
  threadId: 't1',
  from: { name: 'Max Muster', email: 'max@example.org' },
  to: [{ email: 'me@example.org' }],
  cc: [],
  subject: 'Treffen am Freitag',
  date: Date.now(),
  labelIds: ['INBOX'],
  unread: false,
  text: 'Passt dir 18 Uhr?',
  attachments: [],
  inline: [],
};

const page = (url = '/mail') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <MailPage />
    </MemoryRouter>,
  );

const key = (k: string, extra: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(document.body, { key: k, ...extra });

beforeEach(async () => {
  accounts = [full];
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.modify.mockResolvedValue(undefined);
  mocks.trash.mockResolvedValue(undefined);
  mocks.threads.mockResolvedValue({ threads: [summary('t1', 'Rechnung')] });
  mocks.thread.mockResolvedValue({ id: 't1', messages: [message] });
  useUiStore.setState({ toasts: [] });
  localStorage.clear();
  await db.table('mail_thread').clear();
  await db.table('mail_body').clear();
});

describe('filter operators', () => {
  it('adds an operator once and takes it out again, leaving the rest of the search', () => {
    expect(toggleFilter('from:anna', 'is:unread')).toBe('from:anna is:unread');
    expect(toggleFilter('from:anna IS:UNREAD', 'is:unread')).toBe('from:anna');
    expect(toggleFilter('', 'has:attachment')).toBe('has:attachment');
    expect(hasFilter('is:unreadish', 'is:unread')).toBe(false);
  });
});

describe('saved searches', () => {
  it('stay on this device, at most ten, without duplicates', () => {
    saveSearch('from:anna');
    saveSearch('FROM:anna');
    expect(readSaved()).toEqual(['from:anna']);
    for (let i = 0; i < 12; i++) saveSearch(`label:x${i}`);
    expect(readSaved()).toHaveLength(10);
    expect(forgetSearch('from:anna')).not.toContain('from:anna');
  });

  it('a search can be remembered, then sits in the folder column and opens from there', async () => {
    const user = userEvent.setup();
    page('/mail?q=from%3Aanna');
    await screen.findByText('Rechnung');
    await user.click(screen.getByRole('button', { name: 'Suche merken' }));
    expect(readSaved()).toEqual(['from:anna']);
    expect(screen.getByRole('button', { name: 'Nicht mehr merken' })).toBeInTheDocument();
  });

  it('filter chips show once a search runs and write the operator into it', async () => {
    const user = userEvent.setup();
    page('/mail?q=from%3Aanna');
    await screen.findByText('Rechnung');
    const group = screen.getByRole('group', { name: 'Filter für die Suche' });
    await user.click(within(group).getByRole('button', { name: 'Ungelesen' }));
    await waitFor(() =>
      expect(mocks.threads).toHaveBeenLastCalledWith(
        full,
        expect.objectContaining({ query: 'from:anna is:unread' }),
      ),
    );
    expect(within(group).getByRole('button', { name: 'Ungelesen' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('no filter chips on the plain inbox (calm list)', async () => {
    page();
    await screen.findByText('Rechnung');
    expect(screen.queryByRole('group', { name: 'Filter für die Suche' })).toBeNull();
  });
});

describe('keyboard shortcuts', () => {
  const base = {
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: document.body,
    defaultPrevented: false,
  };

  it('maps Gmail keys and ignores typing, modifiers and repeats', () => {
    expect(mailKeyOf({ ...base, key: 'e' })).toBe('archive');
    expect(mailKeyOf({ ...base, key: '#', shiftKey: true })).toBe('trash');
    expect(mailKeyOf({ ...base, key: 'I', shiftKey: true })).toBe('read');
    expect(mailKeyOf({ ...base, key: 'E', shiftKey: true })).toBeUndefined();
    expect(mailKeyOf({ ...base, key: 'e', ctrlKey: true })).toBeUndefined();
    expect(mailKeyOf({ ...base, key: 'e', repeat: true })).toBeUndefined();
    const input = document.createElement('input');
    expect(mailKeyOf({ ...base, key: 'e', target: input })).toBeUndefined();
  });

  it('c opens a new mail, / goes to the search', async () => {
    page();
    await screen.findByText('Rechnung');
    key('/');
    expect(document.activeElement).toBe(screen.getByPlaceholderText(/Absender, Betreff/));
    (document.activeElement as HTMLElement).blur();
    key('c');
    expect(await screen.findByRole('dialog', { name: 'Neue Mail' })).toBeInTheDocument();
  });

  it('in an open thread: s stars at once, e asks before archiving, u goes back', async () => {
    page('/mail?thread=t1');
    await screen.findByRole('button', { name: 'Mit Stern markieren' });
    key('s');
    await waitFor(() =>
      expect(mocks.modify).toHaveBeenCalledWith(full, 't1', { addLabelIds: ['STARRED'] }),
    );
    key('e');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Mail archivieren?')).toBeInTheDocument();
    expect(mocks.modify).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    key('u');
    await waitFor(() => expect(screen.queryByText('Treffen am Freitag')).toBeNull());
  });

  it("the app's own E steps aside in an open mail: E archives, it does not click the focused row", async () => {
    // The app shell's handler, registered first in the capture phase like `layout/useShortcuts.ts`.
    const global = createShortcutHandler({
      destination: () => undefined,
      go: vi.fn(),
      quickAdd: vi.fn(),
      showShortcuts: vi.fn(),
      undo: vi.fn(),
      toolAvailable: () => false,
      openTool: vi.fn(),
      fkeys: () => ({}),
      runAction: vi.fn(),
    });
    window.addEventListener('keydown', global, true);
    try {
      page('/mail?thread=t1');
      await screen.findByRole('button', { name: 'Mit Stern markieren' });
      // A focusable row inside the page, focused like after J/K.
      const row = document.createElement('button');
      row.setAttribute('data-row', '');
      const clicked = vi.fn();
      row.addEventListener('click', clicked);
      const li = document.createElement('li');
      li.append(row);
      document.body.append(li);
      row.focus();
      key('e');
      expect(await screen.findByRole('dialog', {}, { timeout: 3000 })).toBeInTheDocument();
      expect(clicked).not.toHaveBeenCalled();
      li.remove();
    } finally {
      window.removeEventListener('keydown', global, true);
    }
  });

  it('/ works with Shift (German keyboard: Shift+7)', async () => {
    page();
    await screen.findByText('Rechnung');
    key('/', { shiftKey: true });
    expect(document.activeElement).toBe(screen.getByPlaceholderText(/Absender, Betreff/));
  });

  it('switched off in the settings: the keys do nothing', async () => {
    const { setSettings } = await import('@/core/settings/settings');
    await setSettings('module.mail', { shortcuts: false });
    page('/mail?thread=t1');
    await screen.findByText('Treffen am Freitag');
    key('s');
    key('c');
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.modify).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    await setSettings('module.mail', { shortcuts: true });
  });
});

describe('search: on this device and in the mailbox', () => {
  const sealedHeader = async (id: string, subject: string) => {
    const { saveThreads } = await import('../cache');
    await saveThreads(
      'google',
      [{ ...summary(id, subject), from: { name: 'Kita Pusteblume', email: 'kita@example.org' } }],
      {
        list: true,
      },
    );
  };

  it('shows the hits on this device first, highlighted, and the mailbox below without the doubles', async () => {
    await sealedHeader('t-local', 'Elternabend im Mai');
    mocks.threads.mockResolvedValue({
      threads: [summary('t-local', 'Elternabend im Mai'), summary('t-remote', 'Elternabend 2019')],
    });
    page('/mail?q=elternabend');
    const device = await screen.findByRole('heading', { name: /Auf diesem Gerät/ });
    const mailbox = await screen.findByRole('heading', { name: /Im Postfach/ });
    await screen.findByText('2019', { exact: false });
    const deviceSection = device.closest('section')!;
    const mailboxSection = mailbox.closest('section')!;
    expect(
      await within(deviceSection).findByText('Elternabend', { selector: 'mark' }),
    ).toBeInTheDocument();
    expect(within(deviceSection).queryByText(/2019/)).toBeNull();
    expect(within(mailboxSection).getByText(/2019/)).toBeInTheDocument();
    expect(within(mailboxSection).queryByText(/im Mai/)).toBeNull();
  });

  it('offline: the hits on this device stay, the mailbox part says it cannot be reached', async () => {
    await sealedHeader('t-local', 'Elternabend im Mai');
    const { ConnectorError } = await import('@/core/connectors/types');
    mocks.threads.mockRejectedValue(new ConnectorError('network', 'offline'));
    page('/mail?q=pusteblme'); // a typo in the sender's name
    expect(await screen.findByText(/Das Postfach ist gerade nicht erreichbar/)).toBeInTheDocument();
    expect(await screen.findByText('im Mai', { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('an operator only the mailbox knows: the device part says so instead of guessing', async () => {
    await sealedHeader('t-local', 'Elternabend im Mai');
    page('/mail?q=to%3Aanna');
    expect(await screen.findByText(/kann nur das Postfach beantworten/)).toBeInTheDocument();
  });
});

describe('search: the device part', () => {
  it('„Persönlich“ does not narrow a search (an invoice is not from a person) and its chip steps aside', async () => {
    const { saveThreads } = await import('../cache');
    await saveThreads('google', [{ ...summary('t-bill', 'Rechnung Wasser'), personal: false }], {
      list: true,
    });
    mocks.threads.mockResolvedValue({ threads: [] });
    page('/mail?personal=1&q=wasser');
    expect(await screen.findByText('Wasser', { selector: 'mark' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Persönlich' })).toBeNull();
  });

  it('shows 50 hits at first and the next ones on request; the count names all of them', async () => {
    const { saveThreads } = await import('../cache');
    await saveThreads(
      'google',
      Array.from({ length: 120 }, (_, i) => ({
        ...summary(`t${i}`, `Rechnung ${i}`),
        date: Date.now() - i * 60_000,
      })),
      { list: true },
    );
    mocks.threads.mockResolvedValue({ threads: [] });
    const user = userEvent.setup();
    page('/mail?q=rechnung');
    const device = (await screen.findByRole('heading', { name: /Auf diesem Gerät/ })).closest(
      'section',
    )!;
    await waitFor(() => expect(device.querySelectorAll('[data-thread-id]')).toHaveLength(50));
    expect(within(device).getByLabelText(/120/)).toBeInTheDocument();
    await user.click(within(device).getByRole('button', { name: '50 weitere zeigen' }));
    await waitFor(() => expect(device.querySelectorAll('[data-thread-id]')).toHaveLength(100));
    expect(within(device).getByRole('button', { name: '20 weitere zeigen' })).toBeInTheDocument();
  });
});
