// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeRemoteParts } from '@/core/platform/fakeRemote';
import type { RemoteCloseReason } from '@/core/platform/types';
import type { RemoteView } from '@/core/remote/session';
import { useSyncStatus } from '@/core/sync/status';

const fake = vi.hoisted(() => ({
  parts: undefined as unknown as ReturnType<typeof createFakeRemoteParts>,
  supported: true,
  keepAwake: vi.fn(async () => undefined),
  syncNow: vi.fn(async () => undefined),
}));

vi.mock('@/core/platform', () => ({
  getPlatform: () => ({
    kind: 'android',
    isNative: true,
    remote: { ...fake.parts.remote, supported: fake.supported },
    display: { setKeepAwake: fake.keepAwake },
  }),
}));
vi.mock('@/core/sync/service', () => ({ syncNow: fake.syncNow }));

import RemotePage from '../routes/RemotePage';
import { remoteSession, syncRound } from '../session';
import { describe as describeView, pcLine } from '../view';
import RemoteWidget from '../widgets/RemoteWidget';

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const show = async () => {
  const view = render(
    <MemoryRouter>
      <RemotePage />
    </MemoryRouter>,
  );
  // the session opens at most once a second (also across tests: it is the app's one session)
  for (let i = 0; i < 150 && fake.supported && fake.parts.hooks.opens() === 0; i++) {
    await act(async () => new Promise((r) => setTimeout(r, 10)));
  }
  await flush();
  return view;
};
const state = () => screen.getByTestId('remote-state').textContent;
const key = (action: string) => screen.getByTestId(`remote-${action}`) as HTMLButtonElement;

beforeEach(async () => {
  await remoteSession.close();
  fake.parts = createFakeRemoteParts();
  fake.supported = true;
  fake.keepAwake.mockClear();
  fake.syncNow.mockClear();
  useSyncStatus.getState().set({ phase: 'idle', via: 'lanClient', error: undefined });
});

describe('every state has its sentence and its one step', () => {
  const pc = { volume: 42, mute: false, playing: false, locked: false };
  const cases: [RemoteView, string, string | undefined, boolean][] = [
    [{ kind: 'connected', pc }, 'Dein PC · Lautstärke 42 %', undefined, true],
    [{ kind: 'connecting' }, 'Dein PC', undefined, true],
    [{ kind: 'slow' }, 'Dein PC antwortet noch nicht.', 'retry', true],
    [{ kind: 'not-paired' }, 'Noch kein PC gekoppelt.', 'pair', false],
    [{ kind: 'unreachable' }, 'nicht erreichbar', 'retry', false],
    [{ kind: 'no-input-here' }, 'nimmt hier gerade keine Fernbedienung an', 'retry', false],
    [{ kind: 'too-old' }, 'Ist Nemo auf dem PC aktuell?', 'retry', false],
    [{ kind: 'retry' }, 'kam nicht zustande', 'retry', false],
  ];
  it.each(cases)('%j', (view, text, step, usable) => {
    const line = describeView(view, undefined);
    expect(line.text).toContain(text);
    expect(line.step).toBe(step);
    expect(line.usable).toBe(usable);
  });

  const refusals: [RemoteCloseReason, string, string][] = [
    ['remote-off', 'für dieses Handy aus', 'retry'],
    ['not-granted', 'für dieses Handy aus', 'retry'],
    ['paused', 'am PC pausiert', 'retry'],
    ['ended', 'am PC pausiert', 'retry'],
    ['busy', 'ein anderes Gerät', 'retry'],
    ['unsupported', 'nur Windows', 'disable'],
    ['locked', 'PC ist gesperrt', 'retry'],
    ['limit', 'kurz unterbrochen', 'retry'],
  ];
  it.each(refusals)('refused: %s', (reason, text, step) => {
    const line = describeView({ kind: 'refused', reason }, undefined);
    expect(line.text).toContain(text);
    expect(line.step).toBe(step);
    expect(line.usable).toBe(false);
  });

  it('an unconnected session keeps the last known state quietly; "too old" is worded as a check', () => {
    expect(describeView({ kind: 'disconnected' }, pc).text).toBe('Dein PC · Lautstärke 42 %');
    expect(describeView({ kind: 'disconnected' }, undefined).text).toBe('Dein PC');
    expect(describeView({ kind: 'too-old' }, undefined).text).not.toContain('zu alt');
  });

  it('says "Ton aus", an unknown volume and a locked PC in words', () => {
    expect(pcLine({ ...pc, mute: true })).toBe('Dein PC · Ton aus');
    expect(pcLine({ ...pc, volume: null })).toBe('Dein PC · verbunden');
    expect(pcLine({ ...pc, locked: true })).toBe('Dein PC · Lautstärke 42 % · gesperrt');
  });
});

describe('RemotePage (Medien)', () => {
  it('opens a session when it comes to the front and shows the PC’s state', async () => {
    await show();
    expect(fake.parts.hooks.opens()).toBe(1);
    expect(state()).toBe('Dein PC · Lautstärke 42 %');
    // volume lowest, transport above it
    const labels = [
      ...screen.getByRole('group', { name: 'Medien' }).querySelectorAll('button'),
    ].map((b) => b.textContent);
    expect(labels).toEqual(['Vorheriger', 'Wiedergabe', 'Nächster', 'Leiser', 'Lauter']);
  });

  it('louder, quieter and play/pause go to the PC and its answer is the new state', async () => {
    await show();
    fireEvent.click(key('volume-up'));
    await flush();
    expect(state()).toBe('Dein PC · Lautstärke 44 %');
    fireEvent.click(key('volume-down'));
    fireEvent.click(key('volume-down'));
    await flush();
    expect(state()).toBe('Dein PC · Lautstärke 40 %');
    expect(key('play-pause').textContent).toBe('Wiedergabe');
    fireEvent.click(key('play-pause'));
    await flush();
    expect(key('play-pause').textContent).toBe('Pause');
    fireEvent.click(key('next'));
    fireEvent.click(key('previous'));
    await flush();
    expect(fake.parts.hooks.sent()).toEqual([
      'volume-up',
      'volume-down',
      'volume-down',
      'play-pause',
      'next',
      'previous',
    ]);
  });

  it('"Ton aus" and "PC sperren" sit in the menu', async () => {
    await show();
    fireEvent.click(screen.getByRole('button', { name: 'Weitere Aktionen' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ton aus / an' }));
    await flush();
    expect(state()).toBe('Dein PC · Ton aus');
    fireEvent.click(screen.getByRole('button', { name: 'Weitere Aktionen' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'PC sperren' }));
    await flush();
    expect(state()).toBe('Dein PC · Ton aus · gesperrt');
  });

  it('a refusal shows its sentence, one step, and buttons that do nothing', async () => {
    fake.parts.hooks.failOpen('paused');
    await show();
    expect(state()).toContain('Die Fernbedienung ist am PC pausiert.');
    expect(key('play-pause').disabled).toBe(true);
    expect(key('volume-up').disabled).toBe(true);
    // "Erneut versuchen" asks the PC again
    fireEvent.click(screen.getByTestId('remote-retry'));
    await act(async () => new Promise((r) => setTimeout(r, 1100)));
    expect(state()).toBe('Dein PC · Lautstärke 42 %');
    expect(key('play-pause').disabled).toBe(false);
  });

  it('ended at the PC during a session: the sentence appears by itself', async () => {
    await show();
    act(() => fake.parts.hooks.close('ended'));
    expect(state()).toContain('am PC pausiert');
  });

  it('without a pairing it leads to pairing, not to an error', async () => {
    fake.parts.hooks.failOpen('not-paired');
    await show();
    expect(state()).toContain('Noch kein PC gekoppelt.');
    expect(screen.getByRole('link', { name: 'PC koppeln' }).getAttribute('href')).toBe(
      '/settings/sync#sync',
    );
  });

  it('leaving the page ends the session', async () => {
    const view = await show();
    expect(fake.parts.hooks.isOpen()).toBe(true);
    view.unmount();
    await flush();
    expect(fake.parts.hooks.isOpen()).toBe(false);
  });

  it('where the phone app is not running it says so and opens nothing', async () => {
    fake.supported = false;
    await show();
    expect(screen.getByText('Die Fernbedienung gibt es in der Handy-App.')).toBeTruthy();
    expect(fake.parts.hooks.opens()).toBe(0);
  });
});

describe('RemoteWidget', () => {
  it('shows where it stands and one way in, and opens no connection', async () => {
    render(
      <MemoryRouter>
        <RemoteWidget />
      </MemoryRouter>,
    );
    await flush();
    expect(screen.getByText('Dein PC · bereit')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Öffnen' }).getAttribute('href')).toBe('/remote');
    expect(fake.parts.hooks.opens()).toBe(0);
  });
});

describe('what a sync round says about the pairing', () => {
  it('ok, failed, and the two ways of "not paired"', async () => {
    expect(await syncRound()).toBe('ok');
    expect(fake.syncNow).toHaveBeenCalledTimes(1);

    fake.syncNow.mockImplementationOnce(async () => {
      useSyncStatus.getState().set({ phase: 'error', error: 'network' });
    });
    expect(await syncRound()).toBe('failed');

    fake.syncNow.mockImplementationOnce(async () => {
      useSyncStatus.getState().set({ phase: 'error', error: 'revoked' });
    });
    expect(await syncRound()).toBe('not-paired');

    // syncing through a server, or not at all: no PC is paired – and no round is run for it
    fake.syncNow.mockClear();
    useSyncStatus.getState().set({ phase: 'idle', via: 'server', error: undefined });
    expect(await syncRound()).toBe('not-paired');
    expect(fake.syncNow).not.toHaveBeenCalled();
  });
});
