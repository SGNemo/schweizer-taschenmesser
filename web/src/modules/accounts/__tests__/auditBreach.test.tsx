// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/strings';
import type { DecryptedEntry } from '../vault';

const h = vi.hoisted(() => ({ on: false, fetch: vi.fn() }));
vi.mock('@/core/settings/settings', () => ({
  getSettings: async (_s: string, _schema: unknown, defaults: object) => ({
    ...defaults,
    breachCheck: h.on,
  }),
}));
vi.mock('@/core/platform', () => ({ getPlatform: () => ({ fetch: h.fetch }) }));
vi.mock('../strength', () => ({
  StrengthUnavailable: class extends Error {},
  measureStrength: async () => ({ score: 4 }),
}));

afterEach(() => {
  cleanup();
  h.fetch.mockReset();
  h.on = false;
});

const entries = [
  { id: 'e1', data: { title: 'Mail', username: 'a', password: 'password', changedAt: '' } },
] as unknown as DecryptedEntry[];

async function open() {
  const { AuditDialog } = await import('../components/AuditDialog');
  render(<AuditDialog open onClose={() => {}} entries={entries} onOpenEntry={() => {}} />);
}

// The first test imports the dialog's module graph cold.
vi.setConfig({ testTimeout: 40_000 });

describe('AuditDialog leak check', () => {
  it('switch off (default): no request at all', async () => {
    await open();
    await screen.findByText(t.accounts.audit.nothing);
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it('switch on: match is listed calmly', async () => {
    h.on = true;
    h.fetch.mockImplementation(async () => new Response('1E4C9B93F3F0682250B6CF8331B7EE68FD8:7'));
    await open();
    await screen.findByText(t.accounts.audit.breached(1));
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(String(h.fetch.mock.calls[0]?.[0])).toBe('https://api.pwnedpasswords.com/range/5BAA6');
    h.on = false;
  });

  it('switch on, offline: "not available", rest of the audit still finishes', async () => {
    h.on = true;
    h.fetch.mockRejectedValue(new TypeError('offline'));
    await open();
    await screen.findByText(t.accounts.audit.breachUnavailable);
    await waitFor(() => expect(screen.queryByText(t.accounts.audit.running(0, 1))).toBeNull());
    // The local checks found nothing: that all-clear stays, the failed leak check does not hide it.
    await screen.findByText(t.accounts.audit.nothing);
    h.on = false;
  });
});
