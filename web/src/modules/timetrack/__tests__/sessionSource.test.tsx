// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { bus } from '@/core/events';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { SessionEditor } from '../components/SessionEditor';
import { migrations } from '../migrations';
import manifest from '../manifest';
import { sessionRepo, startSession } from '../repo';
import { sessionSchema } from '../schema';
import startServices from '../services';

/** TT1 (planner hub S5, P53): a session keeps what it was started for and names it. */
beforeEach(async () => {
  for (const t of ['timetrack_session', 'calendar_event', '_modules', '_meta'])
    await db.table(t).clear();
  setNow(() => new Date(2026, 10, 15, 9, 0).getTime());
});
afterEach(() => {
  cleanup();
  setNow();
  vi.restoreAllMocks();
});

const only = async () => (await sessionRepo.active().toArray())[0];

describe('a session keeps its source', () => {
  it('the start request’s `<module>:<id>` stays on the session', async () => {
    const stop = startServices();
    try {
      await bus.emit('timetrack.start.requested', {
        title: 'Zahnarzt',
        sourceRef: 'calendar:evt-1',
      });
      await vi.waitFor(async () => expect(await only()).toBeDefined());
      expect(await only()).toMatchObject({ from: 'Zahnarzt', ref: 'calendar:evt-1' });
    } finally {
      stop?.();
    }
  });

  it('anything that is no key (a bare id) is not stored', async () => {
    await startSession(undefined, { from: 'X', ref: 'evt-1' });
    expect((await only())?.ref).toBeUndefined();
    await startSession(undefined, { from: 'Y' });
    expect((await sessionRepo.active().toArray()).every((s) => s.ref === undefined)).toBe(true);
  });

  it('`ref` is internal and its shape change has a version step', () => {
    expect(manifest.version).toBe(2);
    expect(migrations[2]).toBeTypeOf('function');
    expect(sessionSchema.shape.ref.meta()).toMatchObject({ internal: true });
    expect(
      sessionSchema.safeParse({ date: '2026-11-15', startTime: '09:00', ref: 'nope' }).success,
    ).toBe(false);
  });

  it('the editor says „Für: <title>“ and leads to the thing', async () => {
    const event = await createCollectionRepo(getManifest('calendar')!, 'event').create({
      title: 'Zahnarzt',
      startDate: '2026-11-15',
    });
    const s = await startSession(undefined, { from: 'Zahnarzt', ref: `calendar:${event.id}` });
    render(
      <MemoryRouter>
        <SessionEditor target={s} jobs={[]} onClose={() => {}} />
      </MemoryRouter>,
    );
    const link = await screen.findByTestId('session-source', {}, { timeout: 5000 });
    expect(link.textContent).toBe('Zahnarzt');
    expect(link.getAttribute('href')).toBe(`/calendar?open=${event.id}`);
    expect(link.parentElement?.textContent).toBe('Für: Zahnarzt');
  });

  it('a source that is gone shows nothing', async () => {
    const s = await startSession(undefined, { from: 'Weg', ref: 'calendar:evt-gone' });
    render(
      <MemoryRouter>
        <SessionEditor target={s} jobs={[]} onClose={() => {}} />
      </MemoryRouter>,
    );
    await screen.findByLabelText('Notiz');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('session-source')).toBeNull();
  });
});
