// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { SessionEditor } from '../components/SessionEditor';
import { pauseSession, sessionRepo, startSession } from '../repo';

beforeEach(async () => {
  for (const t of ['client', 'job', 'session']) await db.table(`timetrack_${t}`).clear();
});
afterEach(() => {
  cleanup();
  setNow();
});

const at = (h: number) => () => new Date(2026, 10, 5, h, 0).getTime();

async function editNote(id: string, text: string) {
  const target = (await sessionRepo.get(id))!;
  render(<SessionEditor target={target} jobs={[]} onClose={() => {}} />);
  await userEvent.type(await screen.findByLabelText('Notiz'), text);
  await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
}

// QA round 4, X04: editing the running session must not stop it (at the made-up default 10:00).
it('editing the note of a running session keeps it running', async () => {
  setNow(at(8));
  const s = await startSession(undefined, { note: 'Doku' });
  setNow(at(15));
  await editNote(s.id, ' + Tests');
  await waitFor(async () => expect((await sessionRepo.get(s.id))?.note).toBe('Doku + Tests'));
  expect((await sessionRepo.get(s.id))?.endTime).toBeUndefined();
});

it('a running session started after 10:00 can be edited, and its pause is kept', async () => {
  setNow(at(11));
  const s = await startSession(undefined, { note: 'Call' });
  setNow(at(12));
  await pauseSession(s);
  await editNote(s.id, 'x');
  await waitFor(async () => expect((await sessionRepo.get(s.id))?.note).toBe('Callx'));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(await sessionRepo.get(s.id)).toMatchObject({
    pausedAt: '12:00',
    pausedDate: '2026-11-05',
  });
});
