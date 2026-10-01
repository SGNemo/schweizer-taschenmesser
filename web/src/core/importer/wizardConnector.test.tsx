// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ServiceModule from '@/core/connectors/service';
import { saveStatus } from '@/core/connectors/state';
import type { MailFinding } from '@/core/connectors/types';
import { db } from '@/core/db/db';
import { getManifest } from '@/core/modules/registry';
import { invoiceRepo } from '@/modules/invoices/repo';
import { t } from '@/strings';
import { OnboardingWizard } from './OnboardingWizard';

const findings: MailFinding[] = [
  {
    kind: 'invoice',
    ref: 'gmail:1',
    title: 'Stadtwerke Muster',
    url: 'https://mail.example.test/1',
    mailDate: '2026-09-20',
    amountMinor: 8740,
    date: '2026-10-15',
  },
];

const scanMail = vi.hoisted(() => vi.fn());
vi.mock('@/core/connectors/service', async (importOriginal) => ({
  ...(await importOriginal<typeof ServiceModule>()),
  scanMail,
}));

const manifest = getManifest('invoices')!;

beforeEach(async () => {
  scanMail.mockReset();
  await db.table('_meta').clear();
  await db.table('_imports').clear();
  await db.table('invoices_invoice').clear();
  await db.table('_outbox').clear();
});
afterEach(() => vi.restoreAllMocks());

describe('wizard: connector scan', () => {
  it('offers the mail scan only while Google is connected with the mail feature', async () => {
    render(<OnboardingWizard manifest={manifest} open onClose={() => undefined} />);
    expect(await screen.findByText(t.connectors.scan.notConnected)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: new RegExp(t.onboarding.mail.invoices) }),
    ).toBeNull();

    await saveStatus('google', { state: 'connected', features: ['calendar'] });
    await waitFor(() =>
      expect(screen.getByText(t.connectors.scan.notConnected)).toBeInTheDocument(),
    );

    await saveStatus('google', { state: 'connected', features: ['calendar', 'mail'] });
    expect(
      await screen.findByRole('button', { name: new RegExp(t.onboarding.mail.invoices) }),
    ).toBeInTheDocument();
    expect(screen.queryByText(t.connectors.scan.notConnected)).toBeNull();
  });

  it('scans, shows what was read, previews the suggestions and stores only what is confirmed', async () => {
    await saveStatus('google', { state: 'connected', features: ['mail'] });
    scanMail.mockImplementation(
      async (_def, _months, onProgress?: (d: number, t: number) => void) => {
        onProgress?.(2, 2);
        return { findings, read: 2 };
      },
    );
    const user = userEvent.setup();
    render(<OnboardingWizard manifest={manifest} open onClose={() => undefined} />);
    await user.click(
      await screen.findByRole('button', { name: new RegExp(t.onboarding.mail.invoices) }),
    );

    expect(await screen.findByText(t.connectors.scan.intro)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(t.connectors.scan.period), '6');
    await user.click(screen.getByRole('button', { name: t.connectors.scan.start }));

    // Nothing is stored yet: the preview shows the suggestion.
    expect(await screen.findByText(t.onboarding.found(1))).toBeInTheDocument();
    expect(scanMail).toHaveBeenCalledTimes(1);
    expect(scanMail.mock.calls[0]![1]).toBe(6);
    expect(await invoiceRepo.active().count()).toBe(0);
    const row = screen.getByRole('list', { name: t.onboarding.previewTitle });
    expect(within(row).getByText(/Stadtwerke Muster/)).toBeInTheDocument();
    expect(screen.getByText(t.connectors.scan.summary(2, 6))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.onboarding.importN(1) }));
    expect(await screen.findByText(t.onboarding.imported(1))).toBeInTheDocument();
    const [stored] = await invoiceRepo.active().toArray();
    expect(stored).toMatchObject({
      payee: 'Stadtwerke Muster',
      amountMinor: 8740,
      dueDate: '2026-10-15',
    });
    // Only the extracted fields and a link were kept, never mail text.
    expect(JSON.stringify(stored)).not.toMatch(/snippet|subject/i);
  });

  it('explains an empty scan and a failed one without leaking details', async () => {
    await saveStatus('google', { state: 'connected', features: ['mail'] });
    const user = userEvent.setup();
    render(<OnboardingWizard manifest={manifest} open onClose={() => undefined} />);
    await user.click(
      await screen.findByRole('button', { name: new RegExp(t.onboarding.mail.invoices) }),
    );

    scanMail.mockResolvedValueOnce({ findings: [], read: 5 });
    await user.click(screen.getByRole('button', { name: t.connectors.scan.start }));
    expect(await screen.findByText(t.connectors.scan.none)).toBeInTheDocument();

    const { ConnectorError } = await import('@/core/connectors/types');
    scanMail.mockRejectedValueOnce(
      new ConnectorError('expired', 'x access_token=ya29.secretsecretsecret'),
    );
    await user.click(screen.getByRole('button', { name: t.connectors.scan.start }));
    expect(await screen.findByText(/abgelaufen/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/ya29|access_token/);
  });
});
