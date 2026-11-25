// @vitest-environment jsdom
/**
 * A planned mail in the planner (planner hub 2, package 4c; hand-off 04): the host mounts mail's panel for a ToDo whose
 * first `origin` link is a thread, its own checklist under it. Sender · day, subject, the newest message's plain text
 * from the cache; „Antworten“ opens mail's compose window over the planner and sends nothing by itself; when the
 * newest message is his own, „Beantwortet?“ · „Erledigt“ asks the todos module to tick the ToDo (only its id travels).
 * On a device without mail (the phone): X5 and X6, no button. The send window lives at the planner's foot: a reply
 * withdrawn while the row is closed comes back with its text.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { createCollectionRepo } from '@/core/db/repo';
import { PlanPageFoot, PlanPanelHost } from '@/core/modules/PlanPanelHost';
import { getManifest } from '@/core/modules/registry';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { emptyCompose } from '../composeState';
import { queueSend, usePendingSends } from '../pendingSend';

const taskRepo = createCollectionRepo(getManifest('todos')!, 'task');
const base = { createdAt: 1, updatedAt: 1, deviceId: 't', deletedAt: null, _f: {} };
const mod = (id: string) => ({ id, enabled: true, dataPolicy: null, ...base });
const BODY = 'Hallo,\nkannst du mir bis Freitag die Unterlagen schicken?\nDanke, Anna';

async function scene(opts: { lastFromMe?: boolean } = {}) {
  for (const t of ['mail_thread', 'mail_body', 'todos_task', '_modules']) await db.table(t).clear();
  await db.table('_modules').bulkPut([mod('mail'), mod('todos'), mod('planner')]);
  await db.table('mail_thread').put({
    ...base,
    id: 'demo|t1',
    accountKey: 'demo',
    threadId: 't1',
    sortKey: new Date(2026, 10, 27, 9, 0).getTime(),
    unread: true,
    inbox: true,
    demo: {
      from: { name: 'Anna Beispiel', email: 'anna@example.org' },
      subject: 'Treffen am Samstag?',
      snippet: 'Kannst du mir …',
      messageCount: 1,
      hasAttachment: false,
      labelIds: ['INBOX'],
      personal: true,
      ...(opts.lastFromMe ? { lastFromMe: true } : {}),
    },
  });
  await db.table('mail_body').put({
    ...base,
    id: 'demo|m1',
    accountKey: 'demo',
    messageId: 'm1',
    threadId: 't1',
    sortKey: 1,
    demo: {
      from: { name: 'Anna Beispiel', email: 'anna@example.org' },
      to: [{ email: 'test@example.org' }],
      subject: 'Treffen am Samstag?',
      date: new Date(2026, 10, 27, 9, 0).getTime(),
      text: BODY,
    },
  });
  await taskRepo.create(
    {
      listId: 'inbox',
      title: 'Anna Beispiel · Treffen am Samstag?',
      done: false,
      priority: 0,
      order: 0,
      note: 'https://mail.example.org/t1',
      links: [{ kind: 'mail', id: 't1', label: 'Treffen am Samstag?' }],
      checklist: [{ id: 'c1', text: 'Termin prüfen', done: false }],
    },
    { id: 'todo1' },
  );
}

const panel = () =>
  render(
    <MemoryRouter>
      <PlanPanelHost
        moduleId="todos"
        id="todo1"
        to="/todos?open=todo1"
        carrier={{ moduleId: 'mail', id: 't1' }}
      />
    </MemoryRouter>,
  );

const desktop = () => setPlatform({ ...createWebPlatform(), kind: 'desktop', isNative: true });

beforeEach(() => {
  desktop();
  usePendingSends.setState({ items: [] });
});
afterEach(() => {
  setPlatform(createWebPlatform());
  vi.restoreAllMocks();
});

describe('the mail panel of a planned mail', () => {
  it('sender · day, subject, the newest message as text; its checklist under it; one foot', async () => {
    await scene();
    const { container } = panel();
    expect(await screen.findByText('Treffen am Samstag?')).toBeInTheDocument();
    expect(screen.getByText(/^Anna Beispiel · /)).toBeInTheDocument();
    expect(screen.getByTestId('mail-plan-body')).toHaveTextContent(/bis Freitag die Unterlagen/);
    // The ToDo's own lines under it: the checklist, not its note (a mail address) and no second „Ganz öffnen“.
    expect(
      await screen.findByRole('checkbox', { name: '„Termin prüfen“ abhaken' }),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/mail\.example\.org/);
    expect(screen.getAllByRole('button', { name: 'Ganz öffnen' })).toHaveLength(1);
    // The foot stays last: the ToDo's lines come before it.
    const tick = screen.getByRole('checkbox', { name: '„Termin prüfen“ abhaken' });
    const open = screen.getByRole('button', { name: 'Ganz öffnen' });
    expect(tick.compareDocumentPosition(open) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('„Antworten“ opens mail’s compose window over the planner; nothing is sent by it', async () => {
    await scene();
    panel();
    fireEvent.click(await screen.findByRole('button', { name: 'Antworten' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByDisplayValue(/Treffen am Samstag\?/)).toBeInTheDocument();
    expect(usePendingSends.getState().items).toHaveLength(0);
  });

  it('newest message his own: „Beantwortet?“ · „Erledigt“ asks the todos module, only the id travels', async () => {
    await scene({ lastFromMe: true });
    const asked: unknown[] = [];
    const off = bus.on('todo.doneRequested', (req) => {
      asked.push(req);
    });
    panel();
    expect(await screen.findByText('Beantwortet?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Antworten' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Erledigt' }));
    await waitFor(() => expect(asked).toEqual([{ id: 'todo1' }]));
    off();
  });

  it('on a device without mail (the phone): X5 and X6, no button; the checklist stays', async () => {
    setPlatform(createWebPlatform());
    await scene();
    panel();
    expect(await screen.findByText('Mails beantwortest du am PC.')).toBeInTheDocument();
    expect(screen.getByText('Auf diesem Gerät nicht verfügbar.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Antworten' })).toBeNull();
    expect(
      await screen.findByRole('checkbox', { name: '„Termin prüfen“ abhaken' }),
    ).toBeInTheDocument();
    // The ToDo's own way out stays: „Ganz öffnen“ once.
    expect(screen.getAllByRole('button', { name: 'Ganz öffnen' })).toHaveLength(1);
  });

  it('a thread that is not on this device: X5, nothing fetched', async () => {
    await scene();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(
      <MemoryRouter>
        <PlanPanelHost
          moduleId="todos"
          id="todo1"
          to="/todos?open=todo1"
          carrier={{ moduleId: 'mail', id: 'elsewhere1' }}
        />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Auf diesem Gerät nicht verfügbar.')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('the send window at the planner’s foot', () => {
  it('a reply withdrawn while the row is closed comes back with its text', async () => {
    await scene();
    const account = {
      key: 'acc',
      connectorId: 'google',
      email: 'me@example.org',
      features: ['mail-send'],
    };
    queueSend(
      account as never,
      emptyCompose({ to: 'anna@example.org', subject: 'Re: Treffen', text: 'Samstag passt mir.' }),
      60_000,
    );
    render(
      <MemoryRouter>
        <PlanPageFoot />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Zurückziehen' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByDisplayValue('Samstag passt mir.')).toBeInTheDocument();
    expect(usePendingSends.getState().items).toHaveLength(0);
  });
});
