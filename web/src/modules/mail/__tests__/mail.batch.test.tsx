// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorError } from '@/core/connectors/types';
import { db } from '@/core/db/db';
import type {
  MailAccountRef,
  MailLabel,
  MailMessage,
  MailPage as ThreadPage,
  MailThreadSummary,
} from '@/core/mail/types';
import { useUiStore } from '@/stores/ui';

const full: MailAccountRef = {
  key: 'google',
  connectorId: 'google',
  email: 'me@example.org',
  features: ['mail', 'mail-modify'],
};
let accounts: MailAccountRef[] = [full];

const mocks = {
  threads: vi.fn<(ref: MailAccountRef, req: Record<string, unknown>) => Promise<ThreadPage>>(),
  thread: vi.fn(),
  modify: vi.fn(),
  trash: vi.fn(),
  untrash: vi.fn(),
};
vi.mock('@/core/mail/accounts', () => ({ listMailAccounts: async () => accounts }));
vi.mock('@/core/mail/service', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  mailLabels: async () => [
    { id: 'INBOX', name: 'INBOX', kind: 'system', unread: 2 },
    { id: 'TRASH', name: 'TRASH', kind: 'system' },
    { id: 'Label_1', name: 'Belege', kind: 'user' },
  ],
  mailThreads: (ref: MailAccountRef, req: Record<string, unknown>) => mocks.threads(ref, req),
  mailThread: (...a: unknown[]) => mocks.thread(...a),
  mailAttachment: vi.fn(),
  mailUnread: async () => 0,
  mailWebUrl: () => 'https://mail.google.com/mail/#all/t1',
  mailModify: (...a: unknown[]) => mocks.modify(...a),
  mailTrash: (...a: unknown[]) => mocks.trash(...a),
  mailUntrash: (...a: unknown[]) => mocks.untrash(...a),
  mailDrafts: async () => [],
}));

import MailPage from '../routes/MailPage';
import { ThreadView } from '../components/ThreadView';
import { applyChange, applyStep, doneText, STEPS, type MailAction } from '../mailActions';

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

const message = (labelIds: string[]): MailMessage => ({
  id: 'm1',
  threadId: 't1',
  from: { name: 'Max Muster', email: 'max@example.org' },
  to: [{ email: 'me@example.org' }],
  cc: [],
  subject: 'Treffen am Freitag',
  date: Date.now(),
  labelIds,
  unread: labelIds.includes('UNREAD'),
  text: 'Passt dir 18 Uhr?',
  attachments: [],
  inline: [],
});

const labels: MailLabel[] = [
  { id: 'INBOX', name: 'INBOX', kind: 'system' },
  { id: 'Label_1', name: 'Belege', kind: 'user' },
  { id: 'Label_2', name: 'Reisen', kind: 'user' },
];

const lastToast = () => useUiStore.getState().toasts.at(-1);
const onBack = vi.fn();
const onChanged = vi.fn();

function thread(account = full) {
  return render(
    <MemoryRouter>
      <ThreadView
        account={account}
        threadId="t1"
        cacheBodies={false}
        autoLoadImages={false}
        labels={labels}
        confirmMoves
        onChanged={onChanged}
        onCompose={vi.fn()}
        onBack={onBack}
      />
    </MemoryRouter>,
  );
}

const page = (url = '/mail') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <MailPage />
    </MemoryRouter>,
  );

beforeEach(async () => {
  accounts = [full];
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.modify.mockResolvedValue(undefined);
  mocks.trash.mockResolvedValue(undefined);
  mocks.untrash.mockResolvedValue(undefined);
  mocks.threads.mockResolvedValue({
    threads: [summary('t1', 'Rechnung'), summary('t2', 'Newsletter'), summary('t3', 'Termin')],
  });
  onBack.mockReset();
  onChanged.mockReset();
  useUiStore.setState({ toasts: [] });
  localStorage.clear();
  await db.table('mail_thread').clear();
  await db.table('mail_body').clear();
});

describe('every action has its exact way back', () => {
  const start = ['INBOX', 'UNREAD', 'Label_1'];
  it.each(Object.keys(STEPS) as MailAction[])('%s, then its undo, restores the labels', (a) => {
    const step = STEPS[a];
    // Start from a thread the action applies to (spam from the inbox, untrash from the trash …).
    const from = applyChange(start, step.undo);
    expect(applyChange(applyChange(from, step.change), step.undo).sort()).toEqual([...from].sort());
  });

  it('trash and spam always ask; archive asks per setting; the rest never', () => {
    expect(STEPS.trash.asks).toBe('always');
    expect(STEPS.spam.asks).toBe('always');
    expect(STEPS.archive.asks).toBe('moves');
    expect(STEPS.read.asks).toBe('never');
    expect(STEPS.star.asks).toBe('never');
  });

  it('the trash goes through its own endpoints, never through a label change', async () => {
    await applyStep(full, ['a'], STEPS.trash);
    await applyStep(full, ['a'], STEPS.trash, 'undo');
    expect(mocks.trash).toHaveBeenCalledWith(full, 'a');
    expect(mocks.untrash).toHaveBeenCalledWith(full, 'a');
    expect(mocks.modify).not.toHaveBeenCalled();
  });

  it('a batch keeps going after a failure and names what changed, in list order', async () => {
    mocks.modify.mockImplementation(async (_a: unknown, id: string) => {
      if (id === 'b') throw new ConnectorError('network');
    });
    const res = await applyStep(full, ['a', 'b', 'c'], STEPS.archive);
    expect(res.ok).toEqual(['a', 'c']);
    expect(res.failed).toEqual(['b']);
  });

  it('one thread keeps the single wording, many get a count', () => {
    expect(doneText('archive')(1)).toBe('Archiviert.');
    expect(doneText('archive')(3)).toBe('3 archiviert.');
    expect(doneText('star')(1)).toBe('Mit Stern markiert.');
  });
});

describe('star, important, spam and labels in a thread', () => {
  it('star goes straight through and flips the button; undo takes it back', async () => {
    mocks.thread.mockResolvedValue({ id: 't1', messages: [message(['INBOX'])] });
    const user = userEvent.setup();
    thread();
    await user.click(await screen.findByRole('button', { name: 'Mit Stern markieren' }));
    await waitFor(() =>
      expect(mocks.modify).toHaveBeenCalledWith(full, 't1', { addLabelIds: ['STARRED'] }),
    );
    expect(await screen.findByRole('button', { name: 'Stern entfernen' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(lastToast()?.message).toBe('Mit Stern markiert.');
    lastToast()!.action!.run();
    await waitFor(() =>
      expect(mocks.modify).toHaveBeenLastCalledWith(full, 't1', { removeLabelIds: ['STARRED'] }),
    );
    expect(await screen.findByRole('button', { name: 'Mit Stern markieren' })).toBeInTheDocument();
  });

  it('spam asks first, then reports and leaves the thread; undo puts it back in the inbox', async () => {
    mocks.thread.mockResolvedValue({ id: 't1', messages: [message(['INBOX'])] });
    const user = userEvent.setup();
    thread();
    await screen.findByText('Treffen am Freitag');
    await user.click(
      within(screen.getByTestId('mail-actions')).getByRole('button', { name: 'Weitere Aktionen' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Als Spam melden' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Als Spam melden?')).toBeInTheDocument();
    expect(mocks.modify).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Als Spam melden' }));
    await waitFor(() =>
      expect(mocks.modify).toHaveBeenCalledWith(full, 't1', {
        addLabelIds: ['SPAM'],
        removeLabelIds: ['INBOX'],
      }),
    );
    expect(onBack).toHaveBeenCalled();
    lastToast()!.action!.run();
    await waitFor(() =>
      expect(mocks.modify).toHaveBeenLastCalledWith(full, 't1', {
        addLabelIds: ['INBOX'],
        removeLabelIds: ['SPAM'],
      }),
    );
  });

  it('important toggles from the menu', async () => {
    mocks.thread.mockResolvedValue({ id: 't1', messages: [message(['INBOX', 'IMPORTANT'])] });
    const user = userEvent.setup();
    thread();
    await screen.findByText('Treffen am Freitag');
    await user.click(
      within(screen.getByTestId('mail-actions')).getByRole('button', { name: 'Weitere Aktionen' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Nicht mehr wichtig' }));
    await waitFor(() =>
      expect(mocks.modify).toHaveBeenCalledWith(full, 't1', { removeLabelIds: ['IMPORTANT'] }),
    );
  });

  it("shows the thread's own labels; removing one is straight through with an undo", async () => {
    mocks.thread.mockResolvedValue({ id: 't1', messages: [message(['INBOX', 'Label_1'])] });
    const user = userEvent.setup();
    thread();
    const list = await screen.findByRole('list', { name: 'Labels dieses Verlaufs' });
    expect(within(list).getByText('Belege')).toBeInTheDocument();
    expect(within(list).queryByText('Reisen')).toBeNull();
    await user.click(within(list).getByRole('button', { name: 'Label „Belege“ entfernen' }));
    await waitFor(() =>
      expect(mocks.modify).toHaveBeenCalledWith(full, 't1', { removeLabelIds: ['Label_1'] }),
    );
    expect(lastToast()?.message).toBe('Label „Belege“ entfernt.');
    await waitFor(() => expect(screen.queryByRole('list', { name: /Labels/ })).toBeNull());
    lastToast()!.action!.run();
    expect(await screen.findByRole('list', { name: 'Labels dieses Verlaufs' })).toBeInTheDocument();
  });

  it('read-only: labels show, but nothing to remove', async () => {
    mocks.thread.mockResolvedValue({ id: 't1', messages: [message(['INBOX', 'Label_1'])] });
    thread({ ...full, features: ['mail'] });
    const list = await screen.findByRole('list', { name: 'Labels dieses Verlaufs' });
    expect(within(list).queryByRole('button')).toBeNull();
  });

  it('in the trash the way back is the first button', async () => {
    mocks.thread.mockResolvedValue({ id: 't1', messages: [message(['TRASH'])] });
    const user = userEvent.setup();
    thread();
    const back = await screen.findByRole('button', { name: 'Zurücklegen' });
    expect(screen.queryByRole('button', { name: 'In den Papierkorb' })).toBeNull();
    await user.click(back);
    await waitFor(() => expect(mocks.untrash).toHaveBeenCalledWith(full, 't1'));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('select mode in the list', () => {
  it('is only offered with the manage permission', async () => {
    accounts = [{ ...full, features: ['mail'] }];
    page();
    await screen.findByText('Rechnung');
    expect(screen.queryByTestId('mail-select')).toBeNull();
  });

  it('selects two rows; the trash asks once for both, then one undo brings both back', async () => {
    const user = userEvent.setup();
    page();
    await screen.findByText('Rechnung');
    await user.click(screen.getByTestId('mail-select'));
    const boxes = screen.getAllByRole('checkbox', { name: 'Auswählen' });
    expect(boxes).toHaveLength(3);
    await user.click(boxes[0]!);
    await user.click(boxes[2]!);
    const bar = screen.getByRole('region', { name: /Auswahl/ });
    expect(within(bar).getByText('2 ausgewählt')).toBeInTheDocument();
    await user.click(within(bar).getByRole('button', { name: 'In den Papierkorb' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('2 Mails in den Papierkorb legen?')).toBeInTheDocument();
    expect(mocks.trash).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'In den Papierkorb' }));
    await waitFor(() => expect(mocks.trash).toHaveBeenCalledTimes(2));
    expect(mocks.trash.mock.calls.map((c) => c[1]).sort()).toEqual(['t1', 't3']);
    await waitFor(() => expect(lastToast()?.message).toBe('2 in den Papierkorb gelegt.'));
    lastToast()!.action!.run();
    await waitFor(() => expect(mocks.untrash).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(lastToast()?.message).toBe('Zurückgenommen.'));
  });

  it('read from the menu goes straight through for all selected', async () => {
    const user = userEvent.setup();
    page();
    await screen.findByText('Termin');
    await user.click(screen.getByTestId('mail-select'));
    await waitFor(() =>
      expect(screen.getAllByRole('checkbox', { name: 'Auswählen' })).toHaveLength(3),
    );
    await user.click(screen.getByRole('button', { name: 'Alle auswählen' }));
    const bar = screen.getByRole('region', { name: /Auswahl/ });
    expect(within(bar).getByText('3 ausgewählt')).toBeInTheDocument();
    await user.click(within(bar).getByRole('button', { name: 'Weitere Aktionen für die Auswahl' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Als gelesen markieren' }));
    await waitFor(() => expect(mocks.modify).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(lastToast()?.message).toBe('3 als gelesen markiert.'));
  });

  it('a starred row says so beside the time', async () => {
    mocks.threads.mockResolvedValue({ threads: [summary('t1', 'Rechnung', ['INBOX', 'STARRED'])] });
    page();
    expect(await screen.findByRole('img', { name: 'Mit Stern' })).toBeInTheDocument();
  });

  it('another folder starts without a selection', async () => {
    const user = userEvent.setup();
    page();
    await screen.findByText('Rechnung');
    await user.click(screen.getByTestId('mail-select'));
    await user.click(screen.getAllByRole('checkbox', { name: 'Auswählen' })[0]!);
    expect(screen.getByRole('region', { name: /Auswahl/ })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ordner' }), 'TRASH');
    await waitFor(() => expect(screen.queryByRole('region', { name: /Auswahl/ })).toBeNull());
    expect(screen.queryByRole('checkbox', { name: 'Auswählen' })).toBeNull();
  });
});
