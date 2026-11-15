// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { db } from '@/core/db/db';
import { createRepo } from '@/core/db/repo';
import { getTrashSettings } from '@/core/trash/settings';
import { listTrash } from '@/core/trash/trash';
import { setNow } from '@/core/time/now';
import { tTrash } from '@/strings.trash';
import { RecentlyDeletedSection } from './RecentlyDeletedSection';

const s = tTrash.get();
const notes = createRepo('notes_note', z.looseObject({}));
const DAY = 24 * 3600_000;

beforeEach(async () => {
  await Promise.all(
    ['notes_note', '_settings', '_meta', '_outbox'].map((n) => db.table(n).clear()),
  );
  setNow();
});

describe('Zuletzt gelöscht – keep time', () => {
  it('shortening asks first when it drops entries, and keeps the time on "Abbrechen"', async () => {
    const n = await notes.create({ title: 'Alte Notiz' });
    await notes.remove(n.id);
    const deletedAt = (await db.table('notes_note').get(n.id)).deletedAt as number;
    setNow(() => deletedAt + 10 * DAY);
    render(<RecentlyDeletedSection />);
    await screen.findByText('Alte Notiz');
    await userEvent.click(screen.getByRole('button', { name: s.daysOptions['7'] }));
    expect(await screen.findByText(s.shortenBody(1, 7))).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Abbrechen/ }));
    expect((await getTrashSettings()).days).toBe('30');
    await userEvent.click(screen.getByRole('button', { name: s.daysOptions['7'] }));
    await userEvent.click(await screen.findByRole('button', { name: s.shortenConfirm }));
    await waitFor(async () => expect((await getTrashSettings()).days).toBe('7'));
    // Removed for good: a longer time later does not bring it back (its file may be gone already).
    await waitFor(async () =>
      expect(await listTrash(db, deletedAt + 10 * DAY, 90 * DAY)).toHaveLength(0),
    );
  });

  it('lengthening needs no question', async () => {
    render(<RecentlyDeletedSection />);
    await userEvent.click(await screen.findByRole('button', { name: s.daysOptions['90'] }));
    await waitFor(async () => expect((await getTrashSettings()).days).toBe('90'));
    expect(screen.queryByText(s.shortenTitle)).toBeNull();
  });
});
