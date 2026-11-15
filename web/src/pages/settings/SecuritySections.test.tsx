// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPlatform, setPlatform } from '@/core/platform';
import { getSecurityPrefs, resetSecurityPrefsCache } from '@/core/security/prefs';
import { BackupExportForm } from '@/core/backup/BackupExport';
import { t } from '@/strings';
import { tSecurity } from '@/strings.security';
import { AccessSection, ProtectSection } from './SecuritySections';

const s = tSecurity.get();
const inRouter = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  localStorage.clear();
  resetSecurityPrefsCache();
});
afterEach(() => setPlatform(undefined));

describe('Schutz auf diesem Gerät', () => {
  it('offers the screen guard only on Android, where it does something', () => {
    const { unmount } = inRouter(<ProtectSection />);
    expect(screen.queryByText(s.protect.screen)).toBeNull();
    unmount();
    setPlatform({ ...getPlatform(), kind: 'android' });
    inRouter(<ProtectSection />);
    expect(screen.getByText(s.protect.screen)).toBeTruthy();
  });

  it('"Nur verschlüsselte Backups" removes the readable download from the export form', async () => {
    inRouter(
      <>
        <ProtectSection />
        <BackupExportForm />
      </>,
    );
    expect(screen.getByRole('button', { name: t.backup.export })).toBeTruthy();
    await userEvent.click(screen.getByRole('switch', { name: s.protect.encryptedOnly }));
    expect(getSecurityPrefs().encryptedOnly).toBe(true);
    expect(screen.queryByRole('button', { name: t.backup.export })).toBeNull();
    expect(screen.queryByText(t.backup.plainHint)).toBeNull();
    expect(screen.getByRole('button', { name: t.backup.encryptedExport })).toBeTruthy();
  });

  it('leads to the bug-report preview', () => {
    inRouter(<ProtectSection />);
    expect(screen.getByRole('link', { name: s.protect.reportOpen }).getAttribute('href')).toBe(
      '/settings/ueber#diagnostics',
    );
  });
});

describe('Zugriff auf dieses Gerät', () => {
  it('lists only what exists in the browser and never a name or token', async () => {
    inRouter(<AccessSection />);
    const list = await screen.findByTestId('security-access');
    // The browser has no LAN hub, remote control, local API or extension bridge.
    for (const label of [s.access.lan, s.access.remote, s.access.localApi, s.access.extension])
      expect(within(list).queryByText(label)).toBeNull();
  });
});
