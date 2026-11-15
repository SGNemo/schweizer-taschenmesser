// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import type { MailAccountRef, MailLabel, MailMessage } from '@/core/mail/types';
import { useUiStore } from '@/stores/ui';
import type * as PlatformModule from '@/core/platform';

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
  const real = await orig<typeof PlatformModule>();
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
import { addSnippet, insertSnippet, ownText, readSnippets, snippetName } from '../snippets';

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

// jsdom has no object URLs; the preview only needs one to exist.
URL.createObjectURL = vi.fn(() => 'blob:preview');
URL.revokeObjectURL = vi.fn();

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
    const state = onCompose.mock.calls[0]![0];
    expect(state.attachments.map((a) => a.filename)).toEqual(['ok.txt']);
    // Said in the compose window itself, not only in a toast the window could cover.
    expect(state.forwardNote).toMatch(/gross\.zip, weg\.pdf/);
    expect(mocks.attachment).not.toHaveBeenCalledWith(full, 'm1', 'a1');
  });

  it('a second press while the attachments load starts nothing more', async () => {
    mocks.thread.mockResolvedValue({ id: 't1', messages: [message()] });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    mocks.attachment.mockImplementation(async () => {
      await gate;
      return new Uint8Array([1]);
    });
    const user = userEvent.setup();
    view();
    await user.click(await screen.findByRole('button', { name: 'Weiterleiten' }));
    const busy = await screen.findByRole('button', { name: 'Anhänge werden geladen …' });
    expect(busy).toBeDisabled();
    release();
    await waitFor(() => expect(onCompose).toHaveBeenCalledTimes(1));
    expect(mocks.attachment).toHaveBeenCalledTimes(2);
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

  it('never in spam (opening it there confirms the address)', async () => {
    mocks.thread.mockResolvedValue({
      id: 't1',
      messages: [message({ labelIds: ['SPAM'], unsubscribeUrl: 'https://news.example.org/u' })],
    });
    view();
    await screen.findByRole('button', { name: 'Weiterleiten' });
    expect(screen.queryByRole('button', { name: 'Newsletter abbestellen …' })).toBeNull();
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
    expect(img.getAttribute('src')).toBe('blob:preview');
    expect(screen.queryByRole('button', { name: 'vertrag.pdf ansehen' })).toBeNull();
  });
});

describe('text snippets', () => {
  it('kept on this device once, named by their first line', () => {
    expect(addSnippet('Viele Grüße\nSven').added).toBe(true);
    expect(addSnippet('Viele Grüße\nSven').added).toBe(false);
    expect(readSnippets()).toEqual([{ name: 'Viele Grüße', text: 'Viele Grüße\nSven' }]);
    expect(snippetName('x'.repeat(60))).toHaveLength(40);
  });

  it('go below what the user wrote and above the quote, in the order picked', () => {
    const quote = 'Am Montag schrieb Max:\n> zitat';
    const a = { name: 'a', text: 'Danke!' };
    const b = { name: 'b', text: 'Gruß' };
    let body = `Hallo Max,\n\n${quote}`;
    body = insertSnippet(body, a, quote);
    body = insertSnippet(body, b, quote);
    expect(body).toBe(`Hallo Max,\n\nDanke!\n\nGruß\n\n${quote}`);
    expect(insertSnippet('', a)).toBe('Danke!');
    expect(ownText(body, quote).trim()).toBe('Hallo Max,\n\nDanke!\n\nGruß');
  });

  it("never keeps the quote of someone else's mail as a snippet", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ComposeDialog
          account={full}
          initial={emptyCompose({
            text: '\n\nAm Montag schrieb Max:\n> geheim',
            prefill: 'Am Montag schrieb Max:\n> geheim',
          })}
          title="Antworten"
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByText('Textbausteine'));
    expect(screen.getByRole('button', { name: 'Diesen Text als Baustein merken' })).toBeDisabled();
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
