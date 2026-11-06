// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findModel } from '@/core/ai/local/catalogue';
import { writeLocalPrefs } from '@/core/ai/local/prefs';
import { useLocalModel } from '@/core/ai/local/state';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { setPlatform } from '@/core/platform';
import { createFakeLocalModel } from '@/core/platform/fakeLocalModel';
import { createWebPlatform } from '@/core/platform/web';
import { getManifest } from '@/core/modules/registry';
import { getMeta } from '@/core/db/metaKv';
import { FOCUS_SCOPE } from '@/core/settings/focus';
import { setSettings } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';
import { assignmentRepo, dayRepo, itemRepo } from '../repo';
import PlannerPage, { WEEK_CHECK_KEY } from '../routes/PlannerPage';

const NOW = new Date(2026, 10, 9, 10, 0).getTime(); // Monday 2026-11-09
const todos = getManifest('todos')!;
const taskRepo = createCollectionRepo(todos, 'task');

const draw = () =>
  render(
    <MemoryRouter initialEntries={['/planner']}>
      <PlannerPage />
    </MemoryRouter>,
  );

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of [
    'planner_day',
    'planner_item',
    'planner_assignment',
    'todos_task',
    '_settings',
    '_meta',
    '_modules',
  ])
    await db.table(t).clear();
  await db.table('_modules').put({
    id: 'todos',
    enabled: true,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 't',
    deletedAt: null,
    _f: {},
  });
});
afterEach(() => setNow());

describe('planner page', () => {
  it('shows the head figure, seven columns, rows with minutes and parts, a blocker, the waiting group', async () => {
    const a = await taskRepo.create({
      listId: 'inbox',
      title: 'Steuer',
      done: false,
      priority: 2,
      order: 0,
      estimateMin: 120,
    });
    const b = await taskRepo.create({
      listId: 'inbox',
      title: 'Keller',
      done: false,
      priority: 0,
      order: 0,
    });
    await dayRepo.upsert('2026-11-10', {
      date: '2026-11-10',
      blockers: [{ id: 'z', label: 'Zahnarzt', min: 60 }],
    });
    await assignmentRepo.upsert(`todos:${a.id}#0`, {
      itemKey: `todos:${a.id}`,
      k: 0,
      of: 2,
      date: '2026-11-09',
      minutes: 60,
      order: 0,
      reason: 'new',
    });
    await assignmentRepo.upsert(`todos:${a.id}#1`, {
      itemKey: `todos:${a.id}`,
      k: 1,
      of: 2,
      date: '2026-11-10',
      minutes: 60,
      order: 0,
      reason: 'new',
    });
    await itemRepo.upsert(`todos:${b.id}`, {
      source: { module: 'todos', id: b.id },
      excluded: true,
      order: 0,
    });
    draw();
    // (The head figure renders into the frame's hero slot, which only exists inside the shell: e2e covers it.)
    const board = await screen.findByRole('group', { name: 'Wochenbrett' });
    expect(board.querySelectorAll('section')).toHaveLength(7);
    expect(screen.getByTestId('day-2026-11-09')).toHaveTextContent('2 h 12 frei von 3 h 12');
    expect(screen.getByText('Teil 1 von 2')).toHaveClass('sr-only');
    expect(screen.getByText('Zahnarzt')).toBeInTheDocument();
    expect(screen.getByTestId('day-2026-11-10')).toHaveTextContent('1 h 24 frei von 2 h 24');
    // „Nicht planen“ things sit in the waiting group with a way back.
    expect(screen.getByText('Wartet auf freie Zeit')).toBeInTheDocument();
    expect(screen.getByText('Keller')).toBeInTheDocument();
    // Erledigt is one tap: a tick in the row, named after the thing; „Warum hier?“ sits in the ⋯ menu, no reason text at rest.
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('checkbox').every((c) => c.getAttribute('aria-label'))).toBe(true);
    expect(screen.queryByRole('checkbox', { name: 'Erledigt' })).toBeNull();
    expect(screen.queryByText('neu, nach Priorität')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Warum hier?' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Aktionen für Steuer' })[0]!);
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Warum hier?' }));
    await waitFor(() => expect(screen.getByText('neu, nach Priorität')).toBeInTheDocument());
    // Excluded things carry a state, not a verb.
    expect(screen.getByText('nicht im Plan')).toBeInTheDocument();
  });

  it('a day off says so in the head and the empty board offers the one field', async () => {
    await dayRepo.upsert('2026-11-09', { date: '2026-11-09', availableMin: 0, blockers: [] });
    draw();
    expect(await screen.findByTestId('day-2026-11-09')).toHaveTextContent('frei');
    expect(screen.getByTestId('day-2026-11-09')).not.toHaveTextContent('frei von');
    expect(screen.getByLabelText('Eintragen oder sagen')).toBeInTheDocument();
    // One empty state for the whole board, not seven „Nichts geplant“.
    expect(screen.getByTestId('planner-empty')).toHaveTextContent(
      'Noch nichts geplant. Eine Sache reicht.',
    );
    expect(screen.queryAllByText('Nichts geplant')).toHaveLength(0);
    expect(screen.queryByText('Wartet auf freie Zeit')).toBeNull();
  });

  it('„Donnerstag frei“ → preview first, nothing stored; „Übernehmen“ stores it; no model, no request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    draw();
    const field = await screen.findByLabelText('Eintragen oder sagen');
    fireEvent.change(field, { target: { value: 'Donnerstag frei' } });
    fireEvent.submit(field.closest('form')!);
    const preview = await screen.findByTestId('plan-preview');
    expect(preview).toHaveTextContent('Do ist frei.');
    expect(await dayRepo.get('2026-11-12')).toBeUndefined();
    expect(await db.table('todos_task').count()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    await waitFor(async () => expect((await dayRepo.get('2026-11-12'))?.availableMin).toBe(0));
    await waitFor(() => expect(screen.queryByTestId('plan-preview')).toBeNull());
    expect(await db.table('todos_task').count()).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('a sentence the rules cannot read: the local model (desktop, model loaded) reads it, the preview says so, nothing is stored before „Übernehmen“', async () => {
    const MODEL = findModel('qwen3.5-4b')!;
    const fake = createFakeLocalModel({
      models: [{ file: MODEL.file, bytes: MODEL.bytes }],
      answer: () => JSON.stringify({ ops: [{ op: 'available', date: '2026-11-20', value: 0 }] }),
    });
    setPlatform({ ...createWebPlatform(), localModel: fake });
    writeLocalPrefs({ file: MODEL.file, first: true, autoLoad: true, gpu: true });
    await useLocalModel.getState().refresh();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      draw();
      const field = await screen.findByLabelText('Eintragen oder sagen');
      fireEvent.change(field, { target: { value: 'schieb mal den übernächsten Freitag frei' } });
      fireEvent.submit(field.closest('form')!);
      const preview = await screen.findByTestId('plan-preview');
      expect(preview).toHaveTextContent('Vom lokalen Modell gelesen – bitte prüfen.');
      expect(preview).toHaveTextContent('Fr 20.11. ist frei.');
      expect(fake.requests).toHaveLength(1);
      expect(fake.requests[0]!.prompt).toContain('Satz: schieb mal den übernächsten Freitag frei');
      expect(await dayRepo.get('2026-11-20')).toBeUndefined();
      // „Verwerfen“ keeps the sentence and says what the next „Eintragen“ does; it then skips the model.
      fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
      expect(screen.queryByTestId('plan-preview')).toBeNull();
      expect(await dayRepo.get('2026-11-20')).toBeUndefined();
      expect(screen.getByTestId('plan-say')).toHaveTextContent(
        'Verworfen. Noch einmal „Eintragen“ legt ein ToDo an.',
      );
      expect(field).toHaveValue('schieb mal den übernächsten Freitag frei');
      fireEvent.submit(field.closest('form')!);
      // The rules explain (a planning verb they cannot read); the model stays quiet.
      await waitFor(() =>
        expect(screen.getByTestId('plan-say')).toHaveTextContent('Ich kann: Tag frei'),
      );
      expect(fake.requests).toHaveLength(1);
      expect(await db.table('todos_task').count()).toBe(0);
      // A sentence the model reads as "no instruction" becomes a ToDo, and no status line stays behind.
      const steuer = await taskRepo.create({
        listId: 'inbox',
        title: 'Steuer',
        done: false,
        priority: 0,
        order: 0,
      });
      await assignmentRepo.upsert(`todos:${steuer.id}#0`, {
        itemKey: `todos:${steuer.id}`,
        k: 0,
        of: 1,
        date: '2026-11-09',
        minutes: 30,
        order: 0,
        reason: 'new',
      });
      fake.requests.length = 0;
      const quiet = createFakeLocalModel({
        models: [{ file: MODEL.file, bytes: MODEL.bytes }],
        answer: () => JSON.stringify({ ops: [] }),
      });
      setPlatform({ ...createWebPlatform(), localModel: quiet });
      await useLocalModel.getState().refresh();
      await screen.findAllByText('Steuer');
      fireEvent.change(field, { target: { value: 'Steuer Unterlagen sortieren' } });
      fireEvent.submit(field.closest('form')!);
      await waitFor(async () => expect(await db.table('todos_task').count()).toBe(2));
      expect(quiet.requests).toHaveLength(1);
      await waitFor(() => expect(screen.queryByTestId('plan-say')).toBeNull());
      expect(screen.queryByTestId('plan-preview')).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      setPlatform(undefined);
      localStorage.clear();
    }
  });

  it('„Verwerfen“ stores nothing; a sentence it cannot read gets one calm line, not a ToDo', async () => {
    draw();
    const field = await screen.findByLabelText('Eintragen oder sagen');
    fireEvent.change(field, { target: { value: 'Freitag nur 2 Std' } });
    fireEvent.submit(field.closest('form')!);
    await screen.findByTestId('plan-preview');
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
    expect(screen.queryByTestId('plan-preview')).toBeNull();
    expect(await dayRepo.get('2026-11-13')).toBeUndefined();
    fireEvent.change(field, { target: { value: 'schieb das irgendwie' } });
    fireEvent.submit(field.closest('form')!);
    expect(await screen.findByTestId('plan-say')).toHaveTextContent(
      'Ich kann: Tag frei, Zeit je Tag, verschieben, festnageln, nicht planen.',
    );
    expect(await db.table('todos_task').count()).toBe(0);
  });

  it('two matching things → „Meinst du A oder B?“ with both as answers', async () => {
    for (const title of ['Keller aufräumen', 'Keller streichen'])
      await taskRepo.create({ listId: 'inbox', title, done: false, priority: 0, order: 0 });
    // Both wait (no run in this test): they are still things the sentence may name.
    await db.table('_meta').put({
      key: 'planner.lastRun',
      value: {
        today: '2026-11-09',
        hash: '',
        rowsSig: '',
        unplaced: [],
        overflowMin: 0,
        demandMin: 0,
        usableMin: 0,
        titles: {},
      },
    });
    const tasks = await db.table('todos_task').toArray();
    for (const [i, t] of tasks.entries())
      await assignmentRepo.upsert(`todos:${t.id}#0`, {
        itemKey: `todos:${t.id}`,
        k: 0,
        of: 1,
        date: '2026-11-09',
        minutes: 30,
        order: i,
        reason: 'new',
      });
    draw();
    const field = await screen.findByLabelText('Eintragen oder sagen');
    await screen.findAllByText('Keller aufräumen');
    fireEvent.change(field, { target: { value: 'schieb Keller auf Freitag' } });
    fireEvent.submit(field.closest('form')!);
    expect(
      await screen.findByText('Meinst du Keller aufräumen oder Keller streichen?'),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Welches ist gemeint?' })).toBeInTheDocument();
  });

  it('Monday: „Woche prüfen“ is a quiet line only with the switch on; × hides it for the week', async () => {
    draw();
    await screen.findByLabelText('Eintragen oder sagen');
    expect(screen.queryByTestId('week-check-link')).toBeNull();
    await setSettings(FOCUS_SCOPE, { weekCheck: true });
    const line = await screen.findByTestId('week-check-link');
    expect(line).toHaveTextContent('Woche prüfen · 2 Schritte');
    // Nothing opened by itself.
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Für diese Woche ausblenden' }));
    await waitFor(() => expect(screen.queryByTestId('week-check-link')).toBeNull());
    expect(await getMeta(WEEK_CHECK_KEY)).toBe('2026-11-09');
  });
});
