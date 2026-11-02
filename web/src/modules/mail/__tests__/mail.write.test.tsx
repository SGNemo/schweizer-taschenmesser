// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorError } from '@/core/connectors/types';
import { db } from '@/core/db/db';
import type { MailAccountRef, MailLabel, MailMessage } from '@/core/mail/types';
import { useUiStore } from '@/stores/ui';

const mocks = {
  thread: vi.fn(),
  modify: vi.fn(),
  trash: vi.fn(),
  untrash: vi.fn(),
  saveDraft: vi.fn(),
  drafts: vi.fn(),
  send: vi.fn(),
};
vi.mock('@/core/mail/service', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  mailThread: (...a: unknown[]) => mocks.thread(...a),
  mailAttachment: vi.fn(),
  mailWebUrl: () => 'https://mail.google.com/mail/#all/t1',
  mailModify: (...a: unknown[]) => mocks.modify(...a),
  mailTrash: (...a: unknown[]) => mocks.trash(...a),
  mailUntrash: (...a: unknown[]) => mocks.untrash(...a),
  mailSaveDraft: (...a: unknown[]) => mocks.saveDraft(...a),
  mailDrafts: (...a: unknown[]) => mocks.drafts(...a),
  mailSend: (...a: unknown[]) => mocks.send(...a),
}));

import { ComposeDialog } from '../components/ComposeDialog';
import { ThreadView } from '../components/ThreadView';
import { emptyCompose, type ComposeState } from '../composeState';
import { queueSend, resetPendingSends, usePendingSends } from '../pendingSend';

const message: MailMessage = {
  id: 'm1',
  threadId: 't1',
  from: { name: 'Max Muster', email: 'max@example.org' },
  to: [{ email: 'me@example.org' }, { email: 'anna@example.org' }],
  cc: [],
  subject: 'Treffen am Freitag',
  date: new Date(2026, 9, 28, 8, 15).getTime(),
  labelIds: ['INBOX', 'UNREAD'],
  unread: true,
  text: 'Passt dir 18 Uhr?\nGruß Max',
  attachments: [],
  inline: [],
  rfcMessageId: '<m1@example.org>',
};
const labels: MailLabel[] = [
  { id: 'INBOX', name: 'INBOX', kind: 'system' },
  { id: 'Label_1', name: 'Belege', kind: 'user' },
];
const full: MailAccountRef = {
  key: 'google',
  connectorId: 'google',
  email: 'me@example.org',
  features: ['mail', 'mail-modify', 'mail-send'],
};
const readOnly: MailAccountRef = { ...full, features: ['mail'] };

const onBack = vi.fn();
const onChanged = vi.fn();
const onCompose = vi.fn();

function view(account = full, confirmMoves = true) {
  return render(
    <MemoryRouter>
      <ThreadView
        account={account}
        threadId="t1"
        cacheBodies={false}
        autoLoadImages={false}
        labels={labels}
        confirmMoves={confirmMoves}
        onChanged={onChanged}
        onCompose={onCompose}
        onBack={onBack}
      />
    </MemoryRouter>,
  );
}

const lastToast = () => useUiStore.getState().toasts.at(-1);

beforeEach(async () => {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.thread.mockResolvedValue({ id: 't1', messages: [message] });
  mocks.modify.mockResolvedValue(undefined);
  mocks.trash.mockResolvedValue(undefined);
  mocks.untrash.mockResolvedValue(undefined);
  mocks.drafts.mockResolvedValue([]);
  mocks.saveDraft.mockResolvedValue({ id: 'd1', messageId: 'dm1' });
  mocks.send.mockResolvedValue({ id: 's', threadId: 't1' });
  onBack.mockReset();
  onChanged.mockReset();
  onCompose.mockReset();
  resetPendingSends();
  useUiStore.setState({ toasts: [] });
  await db.table('mail_thread').clear();
});

describe('without the permissions the mail stays read-only', () => {
  it('shows no actions, no reply buttons, and says Nemo only reads', async () => {
    view(readOnly);
    await screen.findByText('Treffen am Freitag');
    expect(screen.queryByTestId('mail-actions')).toBeNull();
    expect(screen.queryByTestId('mail-reply')).toBeNull();
    expect(screen.getByText(/Nemo liest nur/)).toBeInTheDocument();
    expect(
      Object.values(mocks)
        .filter((m) => m !== mocks.thread)
        .every((m) => !m.mock.calls.length),
    ).toBe(true);
  });
});

describe('changes to a thread', () => {
  it('mark as unread/read: straight through, with an undo', async () => {
    const user = userEvent.setup();
    view({ ...full }, true);
    await screen.findByText('Treffen am Freitag');
    // the thread is unread: the menu offers "gelesen"
    await user.click(
      within(screen.getByTestId('mail-actions')).getByRole('button', { name: 'Weitere Aktionen' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Als gelesen markieren' }));
    await waitFor(() =>
      expect(mocks.modify).toHaveBeenCalledWith(full, 't1', { removeLabelIds: ['UNREAD'] }),
    );
    expect(lastToast()?.message).toBe('Als gelesen markiert.');
    lastToast()!.action!.run();
    await waitFor(() =>
      expect(mocks.modify).toHaveBeenLastCalledWith(full, 't1', {
        addLabelIds: ['UNREAD'],
        removeLabelIds: undefined,
      }),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it('archive asks first; cancel changes nothing; confirm archives, leaves the thread, can be undone', async () => {
    const user = userEvent.setup();
    view();
    await screen.findByText('Treffen am Freitag');
    await user.click(screen.getByRole('button', { name: 'Archivieren' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Mail archivieren?')).toBeInTheDocument();
    expect(mocks.modify).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(mocks.modify).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Archivieren' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archivieren' }),
    );
    await waitFor(() =>
      expect(mocks.modify).toHaveBeenCalledWith(full, 't1', { removeLabelIds: ['INBOX'] }),
    );
    expect(onBack).toHaveBeenCalled();
    expect(lastToast()?.message).toBe('Archiviert.');
    lastToast()!.action!.run();
    await waitFor(() =>
      expect(mocks.modify).toHaveBeenLastCalledWith(full, 't1', {
        addLabelIds: ['INBOX'],
        removeLabelIds: undefined,
      }),
    );
  });

  it('"Vor dem Archivieren fragen" off: archive goes through at once (the trash still asks)', async () => {
    const user = userEvent.setup();
    view(full, false);
    await screen.findByText('Treffen am Freitag');
    await user.click(screen.getByRole('button', { name: 'Archivieren' }));
    await waitFor(() => expect(mocks.modify).toHaveBeenCalled());
    mocks.modify.mockClear();
    await user.click(screen.getByRole('button', { name: 'In den Papierkorb' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('In den Papierkorb legen?')).toBeInTheDocument();
    expect(mocks.trash).not.toHaveBeenCalled();
  });

  it('trash: confirmed, then undone with "untrash"', async () => {
    const user = userEvent.setup();
    view();
    await screen.findByText('Treffen am Freitag');
    await user.click(screen.getByRole('button', { name: 'In den Papierkorb' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'In den Papierkorb' }),
    );
    await waitFor(() => expect(mocks.trash).toHaveBeenCalledWith(full, 't1'));
    expect(onBack).toHaveBeenCalled();
    lastToast()!.action!.run();
    await waitFor(() => expect(mocks.untrash).toHaveBeenCalledWith(full, 't1'));
  });

  it('label: needs a choice, then adds it to the whole thread', async () => {
    const user = userEvent.setup();
    view();
    await screen.findByText('Treffen am Freitag');
    await user.click(
      within(screen.getByTestId('mail-actions')).getByRole('button', { name: 'Weitere Aktionen' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Label setzen …' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Label setzen' });
    expect(confirm).toBeDisabled();
    await user.selectOptions(within(dialog).getByRole('combobox'), 'Label_1');
    await user.click(confirm);
    await waitFor(() =>
      expect(mocks.modify).toHaveBeenCalledWith(full, 't1', { addLabelIds: ['Label_1'] }),
    );
    expect(lastToast()?.message).toBe('Label „Belege“ gesetzt.');
  });

  it('a failed change says so, changes nothing and keeps the thread open', async () => {
    mocks.trash.mockRejectedValue(new ConnectorError('denied'));
    const user = userEvent.setup();
    view();
    await screen.findByText('Treffen am Freitag');
    await user.click(screen.getByRole('button', { name: 'In den Papierkorb' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'In den Papierkorb' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/Berechtigung/);
    expect(lastToast()?.message).toMatch(/nichts geändert/i);
    expect(onBack).not.toHaveBeenCalled();
  });
});

describe('reply, forward, draft', () => {
  it('reply and forward open the compose window prefilled; reply all only with several recipients', async () => {
    const user = userEvent.setup();
    view();
    await screen.findByText('Treffen am Freitag');
    await user.click(screen.getByRole('button', { name: 'Antworten' }));
    const [replyState, replyTitle] = onCompose.mock.calls[0] as [ComposeState, string];
    expect(replyTitle).toBe('Antworten');
    expect(replyState).toMatchObject({
      to: 'Max Muster <max@example.org>',
      subject: 'Re: Treffen am Freitag',
      threadId: 't1',
      inReplyTo: { messageId: '<m1@example.org>' },
    });
    expect(replyState.text).toContain('> Passt dir 18 Uhr?');
    await user.click(screen.getByRole('button', { name: 'Allen antworten' }));
    expect((onCompose.mock.calls[1] as [ComposeState])[0].cc).toBe('anna@example.org');
    await user.click(screen.getByRole('button', { name: 'Weiterleiten' }));
    const [fwd] = onCompose.mock.calls[2] as [ComposeState];
    expect(fwd).toMatchObject({ to: '', subject: 'Fwd: Treffen am Freitag' });
    expect(fwd.threadId).toBeUndefined();
  });

  it('a draft offers "Entwurf bearbeiten" with its draft id instead of reply', async () => {
    mocks.thread.mockResolvedValue({
      id: 't1',
      messages: [{ ...message, labelIds: ['DRAFT'], unread: false }],
    });
    mocks.drafts.mockResolvedValue([{ id: 'd7', messageId: 'm1' }]);
    const user = userEvent.setup();
    view();
    await screen.findByText('Treffen am Freitag');
    expect(screen.queryByRole('button', { name: 'Antworten' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Entwurf bearbeiten' }));
    await waitFor(() => expect(onCompose).toHaveBeenCalled());
    expect((onCompose.mock.calls[0] as [ComposeState])[0].draftId).toBe('d7');
  });
});

describe('compose window', () => {
  const open = (
    account = full,
    initial: ComposeState = emptyCompose({
      to: 'anna@example.org',
      subject: 'Hallo',
      text: 'Text',
    }),
  ) =>
    render(
      <MemoryRouter>
        <ComposeDialog account={account} initial={initial} title="Neue Mail" onClose={vi.fn()} />
      </MemoryRouter>,
    );

  it('sending needs a review and a confirmation, and even then waits in the send window', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Weiter zum Senden' }));
    const review = await screen.findByTestId('mail-review');
    expect(review).toHaveTextContent('anna@example.org');
    expect(review).toHaveTextContent('Hallo');
    expect(mocks.send).not.toHaveBeenCalled();
    expect(usePendingSends.getState().items).toHaveLength(0);
    await user.click(within(review).getByRole('button', { name: 'Senden bestätigen' }));
    // confirmed: now it waits (and can be withdrawn); still nothing has been sent
    expect(usePendingSends.getState().items).toHaveLength(1);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('going back from the review sends nothing', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Weiter zum Senden' }));
    await user.click(await screen.findByRole('button', { name: 'Zurück zur Mail' }));
    expect(usePendingSends.getState().items).toHaveLength(0);
    expect(screen.queryByTestId('mail-review')).toBeNull();
  });

  it('a wrong address or no recipient stops before the review', async () => {
    const user = userEvent.setup();
    open(full, emptyCompose({ to: 'kaputt', subject: 'x' }));
    await user.click(screen.getByRole('button', { name: 'Weiter zum Senden' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Das ist keine E-Mail-Adresse: kaputt',
    );
    expect(screen.queryByTestId('mail-review')).toBeNull();
    const field = screen.getByLabelText('An');
    await user.clear(field);
    await user.click(screen.getByRole('button', { name: 'Weiter zum Senden' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('mindestens einen Empfänger');
  });

  it('without the send permission there is no send button, only a hint; drafts need the manage permission', async () => {
    const { unmount } = open({ ...full, features: ['mail', 'mail-modify'] });
    expect(screen.queryByRole('button', { name: 'Weiter zum Senden' })).toBeNull();
    expect(screen.getByText(/„E-Mails senden“ ein/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entwurf speichern' })).toBeInTheDocument();
    unmount();
    open(readOnly);
    expect(screen.queryByRole('button', { name: 'Entwurf speichern' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Weiter zum Senden' })).toBeNull();
  });

  it('saving a draft keeps what is typed (even without a recipient), never sends', async () => {
    const user = userEvent.setup();
    open(
      { ...full, features: ['mail', 'mail-modify'] },
      emptyCompose({ subject: 'Später', text: 'Entwurf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Entwurf speichern' }));
    await waitFor(() => expect(mocks.saveDraft).toHaveBeenCalledTimes(1));
    expect(mocks.saveDraft.mock.calls[0]![1]).toMatchObject({
      subject: 'Später',
      text: 'Entwurf',
      to: [],
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('a queued send still honours the permission: nothing without "mail-send"', () => {
    expect(
      queueSend(
        { ...full, features: ['mail', 'mail-modify'] },
        emptyCompose({ to: 'a@example.org' }),
      ),
    ).toBeUndefined();
  });
});
