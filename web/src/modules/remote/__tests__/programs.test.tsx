// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeRemoteParts } from '@/core/platform/fakeRemote';
import { useSyncStatus } from '@/core/sync/status';

const fake = vi.hoisted(() => ({
  parts: undefined as unknown as ReturnType<typeof createFakeRemoteParts>,
  prefs: undefined as undefined | Record<string, unknown>,
}));

vi.mock('@/core/platform', () => ({
  getPlatform: () => ({
    kind: 'android',
    isNative: true,
    remote: { ...fake.parts.remote, supported: true },
    display: { setKeepAwake: async () => undefined },
  }),
}));
vi.mock('@/core/sync/service', () => ({ syncNow: vi.fn(async () => undefined) }));
vi.mock('@/core/settings/settings', () => ({ useSettings: () => [fake.prefs, vi.fn()] }));

import RemotePage from '../routes/RemotePage';
import { remoteSession } from '../session';

const wait = (ms: number) => act(async () => new Promise((r) => setTimeout(r, ms)));
async function until(ready: () => boolean) {
  for (let i = 0; i < 600 && !ready(); i++) await wait(10);
  await wait(0);
}
async function showPage() {
  render(
    <MemoryRouter>
      <RemotePage />
    </MemoryRouter>,
  );
  await until(() => fake.parts.hooks.opens() > 0);
  await wait(0);
}
const menu = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Weitere Aktionen' }));
  return screen.getAllByRole('menuitem').map((item) => item.textContent);
};
const line = () => screen.queryByTestId('remote-program-status')?.textContent ?? '';

beforeEach(async () => {
  await remoteSession.close();
  fake.parts = createFakeRemoteParts();
  fake.prefs = { haptics: false, keepAwake: false, volumeKeys: false, padLegendSeen: true };
  useSyncStatus.getState().set({ phase: 'idle', via: 'lanClient', error: undefined });
});

describe('"Programm starten …"', () => {
  it('is in the menu only when the PC sent its list', async () => {
    await showPage();
    await wait(50);
    expect(menu()).not.toContain('Programm starten …');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await act(async () => fake.parts.hooks.setPrograms(['Editor']));
    await wait(10);
    expect(remoteSession.programs().list).toEqual(['Editor']);
  });

  it('an empty list says where it is made', async () => {
    fake.parts.hooks.setPrograms([]);
    await showPage();
    await until(() => remoteSession.programs().list !== null);
    expect(menu()).toContain('Programm starten …');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Programm starten …' }));
    expect(screen.getByTestId('remote-programs-empty').textContent).toBe(
      'Am PC unter Einstellungen → Verbindungen → Fernsteuerung Programme auswählen.',
    );
    expect(screen.queryAllByTestId('remote-program')).toHaveLength(0);
  });

  it('a name starts it on the mouse level and says so in one calm line', async () => {
    fake.parts.hooks.setGrant('full');
    fake.parts.hooks.setPrograms(['Editor', 'OBS Studio']);
    await showPage();
    await until(() => remoteSession.programs().list !== null);
    menu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Programm starten …' }));
    const names = screen.getAllByTestId('remote-program').map((b) => b.textContent);
    expect(names).toEqual(['Editor', 'OBS Studio']);
    fireEvent.click(screen.getAllByTestId('remote-program')[1]!);
    await until(() => line().includes('geöffnet'));
    expect(fake.parts.hooks.started()).toEqual([1]);
    expect(fake.parts.hooks.level()).toBe('full');
    expect(line()).toContain('OBS Studio wird am PC geöffnet.');
    fireEvent.click(screen.getByRole('button', { name: 'Ausblenden' }));
    await wait(0);
    expect(screen.queryByTestId('remote-program-status')).toBeNull();
  });

  it('a phone the PC grants media only hears why, and nothing starts', async () => {
    fake.parts.hooks.setPrograms(['Editor']);
    await showPage();
    await until(() => remoteSession.programs().list !== null);
    menu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Programm starten …' }));
    fireEvent.click(screen.getByTestId('remote-program'));
    await until(() => line().includes('Darf Programme starten'));
    expect(fake.parts.hooks.started()).toEqual([]);
    remoteSession.programDismiss();
  });
});
