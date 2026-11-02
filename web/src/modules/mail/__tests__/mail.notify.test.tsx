// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { applyPoll, emptyNotifyState, type NotifyState } from '@/core/mail/notify';
import { clearNotifyState, loadNotifyState, saveNotifyState } from '@/core/mail/state';
import type { MailAccountRef, MailPage, MailThreadSummary } from '@/core/mail/types';
import { buildSchedule } from '@/core/notifications/push';
import { collectDue } from '@/core/notifications/collect';
import { setSettings } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';

const account: MailAccountRef = { key: 'google', connectorId: 'google', features: ['mail'] };
let accounts: MailAccountRef[] = [account];
vi.mock('@/core/mail/accounts', () => ({ listMailAccounts: async () => accounts }));
vi.mock('@/core/mail/service', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  mailLabels: async () => [
    { id: 'INBOX', name: 'INBOX', kind: 'system' },
    { id: 'Label_1', name: 'Belege', kind: 'user' },
  ],
}));

import manifest from '../manifest';
import { MailSettingsPanel } from '../components/MailSettingsPanel';
import { saveThreads } from '../cache';
import { defaultDeps, pollAll, type PollDeps } from '../notifyService';
import source from '../notifications';
import { settings, type MailSettings } from '../settings';

const defaults = settings.defaults as unknown as MailSettings;

const MIN = 60_000;
const T0 = new Date(2026, 9, 29, 10, 0).getTime();

const thread = (
  id: string,
  date: number,
  unread = true,
  name = 'Anna Geheim',
): MailThreadSummary => ({
  id,
  messageCount: 1,
  from: { name, email: 'anna@example.org' },
  subject: 'Geheimer Betreff',
  snippet: 'Geheime Vorschau',
  date,
  unread,
  labelIds: ['INBOX', ...(unread ? ['UNREAD'] : [])],
  hasAttachment: false,
});

function fakeDeps(over: Partial<PollDeps> = {}) {
  const store = new Map<string, NotifyState>();
  const calls = { threads: [] as string[], headers: 0 };
  const deps: PollDeps = {
    settings: async () => ({ ...defaults, notify: true }),
    accounts: async () => accounts,
    threads: async (_a, label): Promise<MailPage> => {
      calls.threads.push(label);
      return { threads: pages[label] ?? [] };
    },
    load: async (k) => store.get(k) ?? emptyNotifyState(),
    save: async (k, s) => void store.set(k, s),
    saveHeaders: async () => void (calls.headers += 1),
    now: () => clock,
    ...over,
  };
  return { deps, store, calls };
}
let clock = T0;
let pages: Record<string, MailThreadSummary[]> = {};

beforeEach(async () => {
  accounts = [account];
  clock = T0;
  pages = {};
  setNow(() => T0);
  await db.table('_settings').clear();
  await db.table('_meta').clear();
  await db.table('mail_thread').clear();
});

describe('the poller (reads only, off by default)', () => {
  it('does nothing without a network call while the setting is off', async () => {
    const { deps, calls } = fakeDeps({ settings: async () => defaults });
    expect(await pollAll(deps)).toBe(0);
    expect(calls.threads).toEqual([]);
  });

  it('first look sets the watermark; a later look makes one batch of the new unread mail', async () => {
    const { deps, store, calls } = fakeDeps();
    pages = { INBOX: [thread('old', T0 - 60 * MIN)] };
    await pollAll(deps);
    expect(store.get('google')!.batches).toEqual([]);
    clock = T0 + 20 * MIN;
    pages = {
      INBOX: [
        thread('new1', T0 + 5 * MIN),
        thread('new2', T0 + 6 * MIN),
        thread('old', T0 - 60 * MIN),
      ],
    };
    await pollAll(deps);
    expect(store.get('google')!.batches).toEqual([{ at: clock, ids: ['new1', 'new2'] }]);
    expect(calls.headers).toBe(2); // the saved headers follow what was read
  });

  it('keeps to the chosen interval and the chosen labels', async () => {
    const { deps, calls } = fakeDeps({
      settings: async () => ({
        ...defaults,
        notify: true,
        notifyEvery: '30',
        notifyLabels: ['INBOX', 'Label_1'],
      }),
    });
    await pollAll(deps);
    expect(calls.threads).toEqual(['INBOX', 'Label_1']);
    clock = T0 + 29 * MIN;
    expect(await pollAll(deps)).toBe(0);
    clock = T0 + 30 * MIN;
    expect(await pollAll(deps)).toBe(1);
  });

  it('a failing look (offline, token gone) never throws and backs off', async () => {
    const { deps, store } = fakeDeps({
      threads: async () => {
        throw new Error('offline');
      },
    });
    await expect(pollAll(deps)).resolves.toBe(1);
    expect(store.get('google')).toMatchObject({ failures: 1 });
    clock = T0 + 16 * MIN; // 15 min would be due, but after a failure the wait doubled
    expect(await pollAll(deps)).toBe(0);
  });

  it('only mailboxes with the read feature are looked at', async () => {
    accounts = [{ ...account, features: [] }];
    const { deps, calls } = fakeDeps();
    expect(await pollAll(deps)).toBe(0);
    expect(calls.threads).toEqual([]);
  });

  it('the default dependencies can only read: there is no write in them', () => {
    expect(Object.keys(defaultDeps()).sort()).toEqual(
      ['accounts', 'load', 'now', 'save', 'saveHeaders', 'settings', 'threads'].sort(),
    );
  });
});

describe('the notification', () => {
  const batchAt = T0 + 20 * MIN;
  async function prepare(unread = true) {
    await saveThreads('google', [
      thread('n1', T0 + 5 * MIN, unread),
      thread('n2', T0 + 6 * MIN, unread, 'Ben Geheim'),
    ]);
    await saveNotifyState('google', {
      ...emptyNotifyState(),
      watermark: T0,
      batches: [{ at: batchAt, ids: ['n1', 'n2'] }],
    });
  }
  const range = { from: T0, to: T0 + 60 * MIN };

  it('off: nothing', async () => {
    await prepare();
    expect(await source(range)).toEqual([]);
  });

  it('on: one calm summary, a count only, soft and local, no sender and no subject anywhere', async () => {
    await setSettings('module.mail', { notify: true });
    await prepare();
    const out = await source(range);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      key: `mail-new:google:${batchAt}`,
      at: batchAt,
      title: '2 neue E-Mails',
      url: '/mail',
      soft: true,
      local: true,
    });
    expect(JSON.stringify(out)).not.toMatch(/Geheim|anna@|Vorschau/);
  });

  it('names appear only when asked for', async () => {
    await setSettings('module.mail', { notify: true, notifyNames: true });
    await prepare();
    expect((await source(range))[0]!.body).toBe('Anna Geheim, Ben Geheim');
  });

  it('read in the meantime: nothing is said', async () => {
    await setSettings('module.mail', { notify: true });
    await prepare(false);
    expect(await source(range)).toEqual([]);
  });

  it('only batches inside the asked range', async () => {
    await setSettings('module.mail', { notify: true });
    await prepare();
    expect(await source({ from: batchAt, to: batchAt + MIN })).toEqual([]);
    expect(await source({ from: batchAt - 1, to: batchAt })).toHaveLength(1);
  });

  it('goes through the calm pipeline: quiet hours move it, and it is never uploaded for Web Push', async () => {
    await setSettings('module.mail', { notify: true });
    const at = new Date(2026, 9, 29, 23, 30).getTime(); // inside the default quiet hours 22–07
    await saveThreads('google', [thread('n1', at - MIN)]);
    await saveNotifyState('google', {
      ...emptyNotifyState(),
      watermark: T0,
      batches: [{ at, ids: ['n1'] }],
    });
    const due = await collectDue({ from: at - MIN, to: at + 12 * 60 * MIN }, [manifest]);
    const n = due.find((d) => d.key.startsWith('mail-new:'))!;
    expect(n.at).toBe(new Date(2026, 9, 30, 7, 0).getTime()); // moved to the end of the quiet hours
    expect(await buildSchedule(due, at - 2 * MIN)).toEqual([]); // `local`: not one item leaves the device
  });
});

describe('the mail settings dialog', () => {
  const view = () =>
    render(
      <MemoryRouter>
        <MailSettingsPanel open onClose={() => undefined} />
      </MemoryRouter>,
    );

  it('off: says where to switch it on', async () => {
    view();
    expect(await screen.findByText(/Einstellungen → Module → E-Mail/)).toBeInTheDocument();
    expect(screen.queryByText('Diese Labels zählen')).toBeNull();
  });

  it('on: shows the interval, the labels to choose (INBOX by default) and a link to the quiet hours', async () => {
    await setSettings('module.mail', { notify: true, notifyEvery: '30' });
    const user = userEvent.setup();
    view();
    expect(
      await screen.findByText('Aktiv: Nemo sieht alle 30 Minuten nach, solange die App läuft.'),
    ).toBeInTheDocument();
    const inbox = await screen.findByRole('checkbox', { name: 'Posteingang' });
    expect(inbox).toBeChecked();
    const belege = screen.getByRole('checkbox', { name: 'Belege' });
    expect(belege).not.toBeChecked();
    await user.click(belege);
    await waitFor(async () => {
      const row = (await db.table('_settings').get('module.mail')) as { notifyLabels?: string[] };
      expect(row.notifyLabels).toEqual(['INBOX', 'Label_1']);
    });
    expect(screen.getByRole('link', { name: 'Ruhezeiten und Limit einstellen' })).toHaveAttribute(
      'href',
      expect.stringContaining('/settings/benachrichtigungen'),
    );
  });
});

describe('state helpers', () => {
  it('state is per mailbox, device-local and can be forgotten', async () => {
    await saveNotifyState('google#a1', {
      ...emptyNotifyState(),
      watermark: 5,
      ...applyPoll(emptyNotifyState(), [], 1).state,
    });
    expect((await loadNotifyState('google#a1')).lastPoll).toBe(1);
    expect((await loadNotifyState('google')).watermark).toBeUndefined();
    await clearNotifyState('google#a1');
    expect((await loadNotifyState('google#a1')).lastPoll).toBeUndefined();
  });
});
