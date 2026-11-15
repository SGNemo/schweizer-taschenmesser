// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import type { MailAccountRef, MailLabel, MailMessage } from '@/core/mail/types';
import { useUiStore } from '@/stores/ui';

const mocks = {
  thread: vi.fn(),
  attachment: vi.fn(),
  openUrl: vi.fn(),
  send: vi.fn(),
};
vi.mock('@/core/mail/service', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  mailThread: (...a: unknown[]) => mocks.thread(...a),
  mailAttachment: (...a: unknown[]) => mocks.attachment(...a),
  mailWebUrl: () => 'https://mail.google.com/mail/#all/t1',
  mailDrafts: async () => [],
  mailSend: (...a: unknown[]) => mocks.send(...a),
}));
vi.mock('@/core/platform', async (orig) => {
  const real = await orig<typeof import('@/core/platform')>();
  return {
    ...real,
    getPlatform: () => ({
      ...real.getPlatform(),
      app: { ...real.getPlatform().app, openUrl: (u: string) => mocks.openUrl(u) },
    }),
  };
});

import { ComposeDialog } from '../components/ComposeDialog';
import { ThreadView } from '../components/ThreadView';
import { emptyCompose, type ComposeState } from '../composeState';
import { addSnippet, insertSnippet, readSnippets, snippetName } from '../snippets';

const full: MailAccountRef = {
  key: 'google',
  connectorId: 'google',
  email: 'me@example.org',
  features: ['mail', 'mail-modify', 'mail-send'],
};
const labels: MailLabel[] = [{ id: 'INBOX', name: 'INBOX', kind: 'system' }];

const message = (over: Partial<MailMessage> = {}): MailMessage => ({
  id: 'm1',
  threadId: 't1',
  from: { name: 'Max Muster', email: 'max@example.org' },
  to: [{ email: 'me@example.org' }],
  cc: [],
  subject: 'Unterlagen',
  date: Date.now(),
  labelIds: ['INBOX'],
  unread: false,
  text: 'Anbei die Unterlagen.',
  attachments: [
    { id: 'a1', filename: 'plan.png', mime: 'image/png', size: 2048 },
    { id: 'a2', filename: 'vertrag.pdf', mime: 'application/pdf', size: 4096 },
  ],
  inline: [],
  ...over,
});

const onCompose = vi.fn<(state: ComposeState, title: string) => void>();
function view() {
  return render(
    <MemoryRouter>
      <ThreadView
        account={full}
        threadId="t1"
        cacheBodies={false}
        autoLoadImages={false}
        labels={labels}
        confirmMoves
        onChanged={vi.fn()}
        onCompose={onCompose}
        onBack={vi.fn()}
      />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  for (const m of Object.values(mocks)) m.mockReset();
  onCompose.mockReset();
  mocks.attachment.mockResolvedValue(new Uint8Array([1, 2, 3]));
  useUiStore.setState({ toasts: [] });
  localStorage.clear();
  await db.table('mail_body').clear();
});

describe('forward with the attachments', () => {
  it('fetches the attachments into the compose window, where each is listed', async () => {
    mocks.thread.mockResolvedValue({ id: 't1', messages: [message()] });
    const user = userEvent.setup();
    view();
    await user.click(await screen.findByRole('button', { name: 'Weiterleiten' }));
    await waitFor(() => expect(onCompose).toHaveBeenCalled());
    const [state] = onCompose.mock.calls[0]!;
    expect(state.attachments.map((a) => a.filename)).toEqual(['plan.png', 'vertrag.pdf']);
    expect(state.threadId).toBeUndefined();
  });

  it('what is too large or cannot be fetched stays out, and the toast names it', async () => {
    mocks.thread.mockResolvedValue({
      id: 't1',
      messages: [
        message({
          attachments: [
            { id: 'a1', filename: 'gross.zip', mime: 'application/zip', size: 40_000_000 },
            { id: 'a2', filename: 'weg.pdf', mime: 'application/pdf', size: 10 },
            { id: 'a3', filename: 'ok.txt', mime: 'text/plain', size: 10 },
          ],
        }),
      ],
    });
    mocks.attachment.mockImplementation(async (_a: unknown, _m: string, id: string) => {
      if (id === 'a2') throw new Error('gone');
      return new Uint8Array([1]);
    });
    const user = userEvent.setup();
    view();
    await user.click(await screen.findByRole('button', { name: 'Weiterleiten' }));
    await waitFor(() => expect(onCompose).toHaveBeenCalled());
    expect(onCompose.mock.calls[0]![0].attachments.map((a) => a.filename)).toEqual(['ok.txt']);
    expect(useUiStore.getState().toasts.at(-1)?.message).toMatch(/gross\.zip, weg\.pdf/);
    expect(mocks.attachment).not.toHaveBeenCalledWith(full, 'm1', 'a1');
  });
});

describe('newsletter unsubscribe', () => {
  it('only after a confirmation that names the site, and only opens the page', async () => {
    mocks.thread.mockResolvedValue({
      id: 't1',
      messages: [message({ unsubscribeUrl: 'https://news.example.org/u?id=1' })],
    });
    const user = userEvent.setup();
    view();
    await user.click(await screen.findByRole('button', { name: 'Newsletter abbestellen …' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/news\.example\.org/)).toBeInTheDocument();
    expect(mocks.openUrl).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Seite öffnen' }));
    expect(mocks.openUrl).toHaveBeenCalledWith('https://news.example.org/u?id=1');
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('no link, no button', async () => {
    mocks.thread.mockResolvedValue({ id: 't1', messages: [message()] });
    view();
    await screen.findByRole('button', { name: 'Weiterleiten' });
    expect(screen.queryByRole('button', { name: 'Newsletter abbestellen …' })).toBeNull();
  });
});

describe('image preview', () => {
  it('images can be viewed in the app; a PDF only saved', async () => {
    mocks.thread.mockResolvedValue({ id: 't1', messages: [message()] });
    const user = userEvent.setup();
    view();
    await user.click(await screen.findByRole('button', { name: 'plan.png ansehen' }));
    const img = await screen.findByRole('img', { name: 'plan.png' });
    expect(img.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    expect(screen.queryByRole('button', { name: 'vertrag.pdf ansehen' })).toBeNull();
  });
});

describe('text snippets', () => {
  it('kept on this device, named by their first line, put in front of a quote', () => {
    addSnippet('Viele Grüße\nSven');
    addSnippet('Viele Grüße\nSven');
    expect(readSnippets()).toEqual([{ name: 'Viele Grüße', text: 'Viele Grüße\nSven' }]);
    expect(snippetName('x'.repeat(60))).toHaveLength(40);
    expect(insertSnippet('\n\n> zitat', readSnippets()[0]!)).toBe('Viele Grüße\nSven\n\n> zitat');
    expect(insertSnippet('', readSnippets()[0]!)).toBe('Viele Grüße\nSven');
  });

  it('can be kept from the compose window and inserted with a click', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ComposeDialog
          account={full}
          initial={emptyCompose({ text: 'Danke, passt!' })}
          title="Neue Mail"
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByText('Textbausteine'));
    await user.click(screen.getByRole('button', { name: 'Diesen Text als Baustein merken' }));
    expect(readSnippets()).toHaveLength(1);
    await user.clear(screen.getByRole('textbox', { name: 'Text' }));
    await user.click(screen.getByRole('button', { name: '„Danke, passt!“ einfügen' }));
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue('Danke, passt!');
  });
});
