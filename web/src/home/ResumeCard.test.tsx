// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { AWAY_MS, getContext, markAway, recordContext } from '@/core/focus/context';
import { startSession } from '@/core/focus/session';
import { saveFocusSession } from '@/core/focus/state';
import { patchFocusSettings } from '@/core/settings/focus';
import { setNow } from '@/core/time/now';
import { ResumeCard } from './ResumeCard';

const T0 = new Date(2026, 9, 2, 10, 0).getTime();
const draw = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ResumeCard />} />
        <Route path="/todos" element={<p>ToDos-Seite</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  setNow(() => T0 + AWAY_MS + 1);
  await db.table('_meta').clear();
  await db.table('_settings').clear();
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('ResumeCard', () => {
  it('stays away when nothing is to be resumed', async () => {
    const { container } = draw();
    await new Promise((r) => setTimeout(r, 50));
    expect(container.firstChild).toBeNull();
  });

  it('offers the way back after a break; "Weiter dort" goes there and ends the question', async () => {
    await recordContext('/todos', 'ToDos');
    await markAway(T0);
    draw();
    expect(await screen.findByText('Zuletzt: ToDos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter dort' }));
    expect(await screen.findByText('ToDos-Seite')).toBeInTheDocument();
    expect((await getContext())?.dismissedAt).toBe(T0);
  });

  it('"Nein, danke" hides it', async () => {
    await recordContext('/todos', 'ToDos');
    await markAway(T0);
    draw();
    fireEvent.click(await screen.findByRole('button', { name: 'Nein, danke' }));
    await waitFor(() => expect(screen.queryByTestId('resume-card')).toBeNull());
  });

  it('mentions an open focus round', async () => {
    await recordContext('/todos', 'ToDos');
    await markAway(T0);
    await saveFocusSession(startSession({ id: 't', title: 'Formular' }, 25, T0, '/todos/focus/t'));
    draw();
    expect(await screen.findByText(/Fokus läuft: Formular/)).toBeInTheDocument();
  });

  it('can be switched off', async () => {
    await recordContext('/todos', 'ToDos');
    await markAway(T0);
    await patchFocusSettings({ resumeCard: false });
    draw();
    await new Promise((r) => setTimeout(r, 80));
    expect(screen.queryByTestId('resume-card')).toBeNull();
  });
});
