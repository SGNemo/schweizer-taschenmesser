// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { ConnectorError } from '@/core/connectors/types';
import type {
  MailAccountRef,
  MailMessage,
  MailPage as ThreadPage,
  MailThreadSummary,
} from '@/core/mail/types';

const account: MailAccountRef = { key: 'google', connectorId: 'google', email: 'me@example.org' };
let accounts: MailAccountRef[] = [account];
const threadsMock =
  vi.fn<(ref: MailAccountRef, req: Record<string, unknown>) => Promise<ThreadPage>>();
const threadMock = vi.fn();
const attachmentMock = vi.fn();

vi.mock('@/core/mail/accounts', () => ({ listMailAccounts: async () => accounts }));
vi.mock('@/core/mail/service', () => ({
  mailLabels: async () => [
    { id: 'INBOX', name: 'INBOX', kind: 'system', unread: 2 },
    { id: 'Label_1', name: 'Belege', kind: 'user' },
  ],
  mailThreads: (ref: MailAccountRef, req: Record<string, unknown>) => threadsMock(ref, req),
  mailThread: (...a: unknown[]) => threadMock(...a),
  mailAttachment: (...a: unknown[]) => attachmentMock(...a),
  mailUnread: async () => 0,
  mailWebUrl: () => 'https://mail.google.com/mail/#all/t1',
}));

import MailPage from '../routes/MailPage';

const summary = (id: string, subject: string, unread = false): MailThreadSummary => ({
  id,
  messageCount: 1,
  from: { name: 'Stadtwerke', email: 'rechnung@example.org' },
  subject,
  snippet: 'Vorschau',
  date: Date.now(),
  unread,
  labelIds: ['INBOX'],
  hasAttachment: false,
});

const evilMessage: MailMessage = {
  id: 'm1',
  threadId: 't1',
  from: { name: 'Stadtwerke', email: 'rechnung@example.org' },
  to: [{ email: 'me@example.org' }],
  cc: [],
  subject: 'Rechnung',
  date: Date.now(),
  labelIds: ['INBOX'],
  unread: true,
  html:
    '<p>Hallo</p><script>alert(1)</script><img src="https://track.example.org/p.gif" width="1" height="1">' +
    '<img src="https://cdn.example.org/logo.png" width="100"><a href="javascript:alert(1)">böse</a>',
  attachments: [{ id: 'a1', filename: 'rechnung.pdf', mime: 'application/pdf', size: 2048 }],
  inline: [],
};

const view = (url = '/mail') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <MailPage />
    </MemoryRouter>,
  );

beforeEach(async () => {
  accounts = [account];
  threadsMock.mockReset();
  threadMock.mockReset();
  attachmentMock.mockReset();
  await db.table('mail_thread').clear();
  await db.table('mail_body').clear();
  await db.table('_meta').clear();
});

describe('mail page', () => {
  it('points to the connections when no account is connected', async () => {
    accounts = [];
    view();
    expect(await screen.findByText(/Noch kein Mail-Konto verbunden/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Zu den Verbindungen/ })).toHaveAttribute(
      'href',
      expect.stringContaining('/settings/verbindungen'),
    );
    expect(threadsMock).not.toHaveBeenCalled();
  });

  it('lists the inbox and saves the headers (sealed) for the next start', async () => {
    threadsMock.mockResolvedValue({ threads: [summary('t1', 'Ihre Rechnung', true)] });
    view();
    expect(await screen.findByText('Ihre Rechnung')).toBeInTheDocument();
    expect(threadsMock).toHaveBeenCalledWith(
      account,
      expect.objectContaining({ labelIds: ['INBOX'] }),
    );
    await waitFor(async () => expect(await db.table('mail_thread').count()).toBe(1));
  });

  it('passes the search text through to the provider and does not cache search results', async () => {
    threadsMock.mockResolvedValue({ threads: [summary('t7', 'Treffer')] });
    view('/mail?q=from:stadtwerke%20has:attachment');
    expect(await screen.findByText('Treffer')).toBeInTheDocument();
    expect(threadsMock).toHaveBeenCalledWith(
      account,
      expect.objectContaining({ query: 'from:stadtwerke has:attachment', labelIds: undefined }),
    );
    expect(await db.table('mail_thread').count()).toBe(0);
  });

  it('submits a search from the field', async () => {
    threadsMock.mockResolvedValue({ threads: [] });
    view();
    await userEvent.type(await screen.findByLabelText('Suchen'), 'newer_than:7d{enter}');
    await waitFor(() =>
      expect(threadsMock).toHaveBeenLastCalledWith(
        account,
        expect.objectContaining({ query: 'newer_than:7d' }),
      ),
    );
  });

  it('asks for the next page', async () => {
    threadsMock
      .mockResolvedValueOnce({ threads: [summary('t1', 'Erste')], nextPageToken: 'P2' })
      .mockResolvedValueOnce({ threads: [summary('t2', 'Zweite')] });
    view();
    await userEvent.click(await screen.findByRole('button', { name: 'Mehr laden' }));
    expect(await screen.findByText('Zweite')).toBeInTheDocument();
    expect(threadsMock).toHaveBeenLastCalledWith(
      account,
      expect.objectContaining({ pageToken: 'P2' }),
    );
  });

  it('explains a missing permission and points to the connections', async () => {
    threadsMock.mockRejectedValue(new ConnectorError('denied'));
    view();
    expect(await screen.findByRole('alert')).toHaveTextContent(/Berechtigung/);
    expect(screen.getByRole('link', { name: /Zu den Verbindungen/ })).toBeInTheDocument();
  });

  it('says the sign-in expired and shows the saved headers meanwhile', async () => {
    threadsMock.mockResolvedValueOnce({ threads: [summary('t1', 'Gespeichert')] });
    const first = view();
    await screen.findByText('Gespeichert');
    first.unmount();
    threadsMock.mockRejectedValue(new ConnectorError('expired'));
    view();
    expect(await screen.findByRole('alert')).toHaveTextContent(/abgelaufen/);
    expect(await screen.findByText('Gespeichert')).toBeInTheDocument();
    expect(screen.getByText(/zuletzt gespeicherte Stand/)).toBeInTheDocument();
  });

  it('shows a mail in a script-free sandbox with blocked images and removed trackers', async () => {
    threadMock.mockResolvedValue({ id: 't1', messages: [evilMessage] });
    view('/mail?thread=t1');
    const frame = (await screen.findByTitle(/Inhalt der Mail/)) as HTMLIFrameElement;
    expect(frame.getAttribute('sandbox')).toBe('allow-same-origin'); // never allow-scripts
    const doc = frame.getAttribute('srcdoc')!;
    expect(doc).toContain('Hallo');
    expect(doc).toContain("default-src 'none'");
    expect(doc).not.toMatch(/<script|javascript:|track\.example|cdn\.example/);
    expect(screen.getByText('1 externes Bild blockiert')).toBeInTheDocument();
    expect(screen.getByText('1 Tracking-Pixel entfernt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bilder laden' })).toBeInTheDocument();
    expect(screen.getByText(/Ungelesen-Status ändert sich dadurch nicht/)).toBeInTheDocument();
    // opening a mail only reads: the provider has no way to write
    expect(threadMock).toHaveBeenCalledTimes(1);
  });

  it('lists attachments with a download button', async () => {
    threadMock.mockResolvedValue({ id: 't1', messages: [evilMessage] });
    view('/mail?thread=t1');
    expect(await screen.findByText('rechnung.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'rechnung.pdf herunterladen' })).toBeInTheDocument();
  });
});
