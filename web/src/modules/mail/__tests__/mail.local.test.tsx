// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { enableModule } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import type { MailAccountRef, MailMessage } from '@/core/mail/types';
import { setNow } from '@/core/time/now';

const threadMock = vi.fn();
const summarize = vi.fn();
const suggest = vi.fn();

vi.mock('@/core/mail/service', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  mailThread: (...a: unknown[]) => threadMock(...a),
  mailAttachment: vi.fn(),
  mailWebUrl: () => 'https://mail.google.com/mail/#all/t1',
}));
vi.mock('@/core/mail/localAssist', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  summarizeMail: (...a: unknown[]) => summarize(...a),
  suggestCaptureLine: (...a: unknown[]) => suggest(...a),
}));

import { ThreadView } from '../components/ThreadView';

const account: MailAccountRef = { key: 'google', connectorId: 'google', features: ['mail'] };
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
  text: 'Guten Tag, Ihre Rechnung über 84,30 EUR ist fällig am 15.11.',
  attachments: [],
  inline: [],
};

const view = (localAi: boolean) =>
  render(
    <MemoryRouter>
      <ThreadView
        account={account}
        threadId="t1"
        cacheBodies={false}
        autoLoadImages={false}
        labels={[]}
        confirmMoves
        localAi={localAi}
        onChanged={() => undefined}
        onCompose={() => undefined}
        onBack={() => undefined}
      />
    </MemoryRouter>,
  );

beforeEach(async () => {
  setNow(() => new Date(2026, 9, 29, 10, 0).getTime());
  await clearAll();
  await db.table('mail_link').clear();
  await db.table('mail_body').clear();
  await db.table('invoices_invoice').clear();
  threadMock.mockReset().mockResolvedValue({ id: 't1', messages: [message] });
  summarize.mockReset();
  suggest.mockReset();
  await enableModule(getManifest('invoices')!);
});

describe('"the local model may read mail" is off until switched on', () => {
  it('off: no button, the model is never asked', async () => {
    view(false);
    await screen.findByText('Ihre Rechnung für Oktober');
    expect(screen.queryByRole('button', { name: 'Kurz zusammenfassen' })).toBeNull();
    expect(summarize).not.toHaveBeenCalled();
  });

  it('on: summarises with the local model, shows who answered, says it is not stored, stores nothing', async () => {
    summarize.mockResolvedValue({
      text: 'Rechnung über 84,30 EUR, fällig am 15.11.',
      source: 'built-in',
      model: 'm.gguf',
    });
    const user = userEvent.setup();
    view(true);
    await user.click(await screen.findByRole('button', { name: 'Kurz zusammenfassen' }));
    const box = await screen.findByTestId('mail-local-summary');
    expect(box).toHaveTextContent('Zusammenfassung vom lokalen Modell (eingebaut)');
    expect(box).toHaveTextContent('Rechnung über 84,30 EUR, fällig am 15.11.');
    expect(box).toHaveTextContent('Wird nicht gespeichert');
    expect(summarize).toHaveBeenCalledTimes(1);
    expect(summarize.mock.calls[0]![0]).toMatchObject({ subject: 'Ihre Rechnung für Oktober' });
    // the answer lives on the screen only
    expect(await db.table('mail_body').count()).toBe(0);
    expect(await db.table('mail_link').count()).toBe(0);
    await user.click(within(box).getByRole('button', { name: 'Schließen' }));
    expect(screen.getByRole('button', { name: 'Kurz zusammenfassen' })).toBeInTheDocument();
  });

  it('no local model ready: a hint with the way to the AI settings, no other model is tried', async () => {
    summarize.mockResolvedValue(undefined);
    const user = userEvent.setup();
    view(true);
    await user.click(await screen.findByRole('button', { name: 'Kurz zusammenfassen' }));
    const box = await screen.findByTestId('mail-local-summary');
    expect(box).toHaveTextContent('Kein lokales Modell bereit');
    expect(box).toHaveTextContent('Cloud-Modelle bekommen keine Mails');
    expect(within(box).getByRole('link', { name: 'Zu den KI-Einstellungen' })).toHaveAttribute(
      'href',
      expect.stringContaining('/settings/ki'),
    );
  });

  it('a failing model says so calmly', async () => {
    summarize.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    view(true);
    await user.click(await screen.findByRole('button', { name: 'Kurz zusammenfassen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('keine Antwort geben');
  });
});

describe('a suggestion for "create from this mail"', () => {
  async function openInvoiceDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Aus dieser Mail anlegen' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rechnung' }));
    return screen.findByRole('dialog');
  }

  it('is only offered when switched on', async () => {
    const user = userEvent.setup();
    view(false);
    const dialog = await openInvoiceDialog(user);
    expect(
      within(dialog).queryByRole('button', { name: 'Vorschlag vom lokalen Modell' }),
    ).toBeNull();
  });

  it('is shown first, used only on "Übernehmen", and saves nothing by itself', async () => {
    suggest.mockResolvedValue({
      text: 'Stadtwerke 84,30 € 15.11.2026',
      source: 'ollama',
      model: 'q',
    });
    const user = userEvent.setup();
    view(true);
    const dialog = await openInvoiceDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Vorschlag vom lokalen Modell' }));
    const box = await within(dialog).findByTestId('mail-local-suggest');
    expect(box).toHaveTextContent('Vorschlag: Stadtwerke 84,30 € 15.11.2026');
    expect(suggest.mock.calls[0]![0]).toBe('invoice');
    // not applied yet: the field still has the rule-based prefill; nothing saved
    expect(within(dialog).getByRole('textbox')).toHaveValue(
      'Stadtwerke Musterstadt 84,30 € 15.11.2026',
    );
    expect(await db.table('invoices_invoice').count()).toBe(0);
    await user.click(within(box).getByRole('button', { name: 'Übernehmen' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('textbox')).toHaveValue('Stadtwerke 84,30 € 15.11.2026'),
    );
    expect(await db.table('invoices_invoice').count()).toBe(0); // still the user's call to save
  });

  it('"Verwerfen" keeps the prefill; no local model says so', async () => {
    suggest.mockResolvedValueOnce({ text: 'Etwas anderes', source: 'built-in', model: 'm' });
    const user = userEvent.setup();
    view(true);
    const dialog = await openInvoiceDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Vorschlag vom lokalen Modell' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Verwerfen' }));
    expect(within(dialog).getByRole('textbox')).toHaveValue(
      'Stadtwerke Musterstadt 84,30 € 15.11.2026',
    );
    suggest.mockResolvedValueOnce(undefined);
    await user.click(within(dialog).getByRole('button', { name: 'Vorschlag vom lokalen Modell' }));
    expect(await within(dialog).findByText(/Kein lokales Modell bereit/)).toBeInTheDocument();
  });
});
