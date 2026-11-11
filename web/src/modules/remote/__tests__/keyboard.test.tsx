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
async function showKeyboard() {
  render(
    <MemoryRouter>
      <RemotePage />
    </MemoryRouter>,
  );
  await until(() => fake.parts.hooks.opens() > 0);
  fireEvent.click(screen.getByRole('button', { name: 'Tastatur' }));
  await wait(0);
}
const field = () => screen.getByTestId('remote-text') as HTMLInputElement;
const state = () => screen.getByTestId('remote-state').textContent;
const type = (value: string) => fireEvent.change(field(), { target: { value } });
/** The enter key of the phone's keyboard submits the form. */
const enter = () => fireEvent.submit(field().closest('form')!);

beforeEach(async () => {
  await remoteSession.close();
  fake.parts = createFakeRemoteParts();
  fake.prefs = { haptics: false, keepAwake: false, volumeKeys: false, padLegendSeen: true };
  useSyncStatus.getState().set({ phase: 'idle', via: 'lanClient', error: undefined });
});

describe('page Tastatur', () => {
  it('type, read, send: the enter key sends the line and Enter, "Senden" the line alone', async () => {
    fake.parts.hooks.setGrant('full');
    await showKeyboard();
    await until(() => fake.parts.hooks.level() === 'full');
    type('grüße 👋');
    enter();
    await until(() => fake.parts.hooks.typed().length === 1);
    expect(fake.parts.hooks.typed()).toEqual(['grüße 👋']);
    expect(fake.parts.hooks.sent()).toEqual(['key-enter']);
    // sent: the field is empty again, and nothing of it is kept anywhere on the page
    expect(field().value).toBe('');
    expect(document.body.textContent).not.toContain('grüße');

    type('ohne Enter');
    fireEvent.click(screen.getByTestId('remote-send'));
    await until(() => fake.parts.hooks.typed().length === 2);
    expect(fake.parts.hooks.typed()[1]).toBe('ohne Enter');
    expect(fake.parts.hooks.sent()).toEqual(['key-enter']);
    expect(field().value).toBe('');
    // an empty field: "Senden" does nothing, the enter key is Enter alone
    fireEvent.click(screen.getByTestId('remote-send'));
    enter();
    await until(() => fake.parts.hooks.sent().length === 2);
    expect(fake.parts.hooks.typed().length).toBe(2);
    expect(fake.parts.hooks.sent()).toEqual(['key-enter', 'key-enter']);
  });

  it('the keys of the fixed list, in the rows of the concept; more behind "Mehr Tasten"', async () => {
    fake.parts.hooks.setGrant('full');
    await showKeyboard();
    await until(() => fake.parts.hooks.level() === 'full');
    const names = () =>
      [
        ...screen.getByTestId('remote-keys').querySelectorAll('button[data-testid^="remote-key-"]'),
      ].map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(names()).toEqual([
      'Enter',
      'Rücktaste',
      'Esc',
      'Tab',
      'Fenster wechseln',
      'Vollbild',
      'Pfeil nach oben',
      'Pfeil nach links',
      'Pfeil nach unten',
      'Pfeil nach rechts',
    ]);
    fireEvent.click(screen.getByTestId('remote-key-backspace'));
    fireEvent.click(screen.getByTestId('remote-key-alt-tab'));
    fireEvent.click(screen.getByTestId('remote-key-left'));
    await until(() => fake.parts.hooks.sent().length === 3);
    expect(fake.parts.hooks.sent()).toEqual(['key-backspace', 'key-alt-tab', 'key-left']);
    fireEvent.click(screen.getByTestId('remote-more-keys'));
    expect(names().slice(10)).toEqual(['Leertaste', 'Pos1', 'Ende', 'Bild auf', 'Bild ab', 'Entf']);
    fireEvent.click(screen.getByTestId('remote-key-delete'));
    await until(() => fake.parts.hooks.sent().length === 4);
    expect(fake.parts.hooks.sent().at(-1)).toBe('key-delete');
  });

  it('while the phone’s keyboard is open only the field and its buttons show', async () => {
    fake.parts.hooks.setGrant('full');
    await showKeyboard();
    await until(() => fake.parts.hooks.level() === 'full');
    expect(screen.getByTestId('remote-keys')).toBeTruthy();
    fireEvent.focus(field());
    expect(screen.queryByTestId('remote-keys')).toBeNull();
    expect(screen.getByTestId('remote-show-keys')).toBeTruthy();
    fireEvent.blur(field());
    expect(screen.getByTestId('remote-keys')).toBeTruthy();
    expect(screen.queryByTestId('remote-show-keys')).toBeNull();
  });

  it('a text that did not go out stays in the field, with one calm sentence', async () => {
    fake.parts.hooks.setGrant('full');
    await showKeyboard();
    await until(() => fake.parts.hooks.level() === 'full');
    fake.parts.hooks.cutNextText(2);
    type('abcdef');
    enter();
    await until(() => screen.queryByTestId('remote-type-note') !== null);
    expect(screen.getByTestId('remote-type-note').textContent).toBe(
      'Nur ein Teil kam am PC an. Sieh am PC nach, bevor du noch einmal sendest.',
    );
    expect(field().value).toBe('abcdef');
    // the next send that works takes the sentence away
    fireEvent.click(screen.getByTestId('remote-send'));
    await until(() => field().value === '');
    expect(screen.queryByTestId('remote-type-note')).toBeNull();
  });

  it('on a locked PC nothing is typed, the text stays and the state line says why', async () => {
    fake.parts.hooks.setGrant('full');
    await showKeyboard();
    await until(() => fake.parts.hooks.level() === 'full');
    type('geheim');
    await act(async () => fake.parts.hooks.setState({ locked: true }));
    expect(state()).toContain('PC ist gesperrt.');
    expect(field().disabled).toBe(true);
    expect(field().value).toBe('geheim');
    expect(fake.parts.hooks.typed()).toEqual([]);
  });

  it('a phone granted media only reads its sentence; field and keys are inactive', async () => {
    await showKeyboard();
    expect(state()).toContain('Maus und Tastatur sind am PC für dieses Handy aus.');
    expect(field().disabled).toBe(true);
    expect((screen.getByTestId('remote-key-enter') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('remote-send') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('remote-to-media'));
    expect(screen.getByTestId('remote-play-pause')).toBeTruthy();
  });
});
