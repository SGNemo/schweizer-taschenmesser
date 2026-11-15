// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router';
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
import PlannerPage, { DAY_KEY, THEN_WIDE_KEY, WEEK_CHECK_KEY } from '../routes/PlannerPage';

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
  it('shows the week as a band of seven tiles, the picked day as a sheet with parts and a blocker, the waiting group', async () => {
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
    // Planner hub R1: one day at a time, as a sheet under the week band (seven tiles at every width). The page
    // opens on the first day that holds things – here today.
    const band = await screen.findByRole('group', { name: 'Woche' });
    const chips = within(band).getAllByRole('button');
    expect(chips).toHaveLength(7);
    await waitFor(() => expect(chips[0]).toHaveAttribute('aria-pressed', 'true'));
    expect(chips[0]).toHaveAttribute('aria-current', 'date');
    expect(chips[0]).toHaveAccessibleName(
      'Heute, Montag, 9. November: 2 h 12 frei von 3 h 12 · 1 Ding',
    );
    expect(chips[1]).toHaveAccessibleName(
      'Morgen, Dienstag, 10. November: 1 h 24 frei von 2 h 24 · 1 Ding',
    );
    const sheet = screen.getByTestId('day-2026-11-09');
    expect(sheet).toHaveTextContent('2 h 12 frei von 3 h 12');
    expect(within(sheet).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Heute · Montag, 9. November',
    );
    // One row form: the source in a word, the duration at the end, „Zuerst“ above the first rows.
    expect(within(sheet).getByRole('heading', { level: 3, name: 'Zuerst' })).toBeInTheDocument();
    expect(within(sheet).getByRole('list', { name: 'Zuerst' })).toHaveTextContent('ToDo');
    expect(within(sheet).getByRole('list', { name: 'Zuerst' })).toHaveTextContent('1 h');
    expect(screen.getByText('Teil 1 von 2')).toHaveClass('sr-only');
    // Another day is one click away: its blocker shows then.
    expect(screen.queryByText('Zahnarzt')).toBeNull();
    fireEvent.click(chips[1]!);
    expect(screen.getByTestId('day-2026-11-10')).toHaveTextContent('1 h 24 frei von 2 h 24');
    expect(screen.getByTestId('day-2026-11-10')).toHaveTextContent(
      'Morgen · Dienstag, 10. November',
    );
    expect(screen.getByText('Zahnarzt')).toBeInTheDocument();
    // The pick is said for screen readers and kept for today on this device.
    expect(screen.getByTestId('planner-status')).toHaveTextContent(
      'Morgen, Dienstag, 10. November: 1 h 24 frei von 2 h 24 · 1 Ding',
    );
    await waitFor(async () =>
      expect(await getMeta(DAY_KEY)).toEqual({ date: '2026-11-10', on: '2026-11-09' }),
    );
    fireEvent.click(chips[0]!);
    // „Nicht planen“ things sit in the waiting group with a way back.
    expect(screen.getByText('Wartet auf freie Zeit')).toBeInTheDocument();
    expect(screen.getByText('Keller')).toBeInTheDocument();
    // Erledigt is one tap: a tick in the row's lead slot, named „Erledigt: <thing>“; „Warum hier?“ sits in the ⋯ menu,
    // no reason text at rest.
    expect(screen.getByRole('checkbox', { name: 'Erledigt: Steuer' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Erledigt' })).toBeNull();
    expect(screen.queryByText('neu, nach Priorität')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Warum hier?' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Aktionen für Steuer' })[0]!);
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Warum hier?' }));
    await waitFor(() => expect(screen.getByText('neu, nach Priorität')).toBeInTheDocument());
    // The waiting group starts folded with its calming sentence (Q4 a); its rows keep the reason
    // behind „Warum hier?“ too. Excluded things carry a state, not a verb.
    expect(screen.getByText('· Nichts davon muss heute sein.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Wartet auf freie Zeit/ }).getAttribute('aria-expanded'),
    ).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /Wartet auf freie Zeit/ }));
    expect(screen.queryByText('nicht im Plan')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Aktionen für Keller' })[0]!);
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Warum hier?' }));
    await waitFor(() => expect(screen.getByText('nicht im Plan')).toBeInTheDocument());
  });

  it('the row ⋯ has „Dauer …“ and „Als Pause …“: each opens its choice, one tap acts', async () => {
    const a = await taskRepo.create({
      listId: 'inbox',
      title: 'Duschen',
      done: false,
      priority: 0,
      order: 0,
    });
    await assignmentRepo.upsert(`todos:${a.id}#0`, {
      itemKey: `todos:${a.id}`,
      k: 0,
      of: 1,
      date: '2026-11-09',
      minutes: 30,
      order: 0,
      reason: 'new',
    });
    draw();
    const open = async () => {
      fireEvent.click((await screen.findAllByRole('button', { name: 'Aktionen für Duschen' }))[0]!);
    };
    await open();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Dauer …' }));
    const sheet = await screen.findByRole('dialog', { name: 'Dauer: Duschen' });
    expect(
      within(sheet)
        .getAllByRole('button', { pressed: false })
        .map((b) => b.textContent),
    ).toEqual(['5 Min', '15 Min', '30 Min', '1 h']);
    fireEvent.click(within(sheet).getByRole('button', { name: '15 Min' }));
    await waitFor(async () => expect((await taskRepo.get(a.id))!.estimateMin).toBe(15));
    await open();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Als Pause …' }));
    const pause = await screen.findByRole('dialog', { name: 'Duschen als Pause' });
    fireEvent.click(within(pause).getByRole('button', { name: '1 h' }));
    await waitFor(async () =>
      expect((await dayRepo.get('2026-11-09'))?.blockers.map((b) => [b.label, b.min])).toEqual([
        ['Duschen', 60],
      ]),
    );
    expect(await taskRepo.get(a.id)).toBeUndefined();
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

  it('the day sheet offers „2 h · 4 h · 6 h · ganzer Tag“: one tap sets the day, the pick shows as chosen (W09)', async () => {
    draw();
    const day = await screen.findByTestId('day-2026-11-09');
    // R2: the capacity opens „Warum?“, „Zeit ändern“ in it the day's settings.
    fireEvent.click(within(day).getByTestId('planner-why'));
    fireEvent.click(within(day).getByRole('button', { name: /^Zeit für .* ändern$/ }));
    const sheet = await screen.findByRole('dialog');
    const picks = within(
      within(sheet).getByRole('group', { name: 'Verfügbare Zeit schnell wählen' }),
    );
    expect(picks.getAllByRole('button').map((b) => b.textContent)).toEqual([
      '2 h',
      '4 h',
      '6 h',
      'ganzer Tag',
    ]);
    fireEvent.click(picks.getByRole('button', { name: '6 h' }));
    // The day's own row only, never the weekday setting.
    await waitFor(async () => expect((await dayRepo.get('2026-11-09'))?.availableMin).toBe(360));
    await waitFor(() =>
      expect(picks.getByRole('button', { name: '6 h' })).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(await db.table('_settings').count()).toBe(0);
    fireEvent.click(picks.getByRole('button', { name: 'ganzer Tag' }));
    await waitFor(async () => expect((await dayRepo.get('2026-11-09'))?.availableMin).toBe(720));
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
    const model = (answer: () => string) => {
      const fake = createFakeLocalModel({
        models: [{ file: MODEL.file, bytes: MODEL.bytes }],
        answer,
      });
      setPlatform({ ...createWebPlatform(), localModel: fake });
      return fake;
    };
    let fake = model(() =>
      JSON.stringify({ ops: [{ op: 'available', date: '2026-11-20', value: 0 }] }),
    );
    writeLocalPrefs({ file: MODEL.file, first: true, autoLoad: true, gpu: true });
    await useLocalModel.getState().refresh();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
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
      draw();
      const field = await screen.findByLabelText('Eintragen oder sagen');
      await screen.findAllByText('Steuer');
      // (a) A planning verb the rules cannot read: the model's reading, as a preview with the note.
      fireEvent.change(field, { target: { value: 'schieb mal den übernächsten Freitag frei' } });
      fireEvent.submit(field.closest('form')!);
      const preview = await screen.findByTestId('plan-preview');
      expect(preview).toHaveTextContent('Vom lokalen Modell gelesen – bitte prüfen.');
      expect(preview).toHaveTextContent('Fr 20.11. ist frei.');
      expect(fake.requests).toHaveLength(1);
      expect(fake.requests[0]!.prompt).toContain('Satz: schieb mal den übernächsten Freitag frei');
      expect(await dayRepo.get('2026-11-20')).toBeUndefined();
      // „Verwerfen“: the sentence stays, the rules' own line stands (no ToDo promised), the field has focus.
      fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
      expect(screen.queryByTestId('plan-preview')).toBeNull();
      expect(await dayRepo.get('2026-11-20')).toBeUndefined();
      expect(screen.getByTestId('plan-say')).toHaveTextContent('Ich kann: Tag frei');
      expect(field).toHaveValue('schieb mal den übernächsten Freitag frei');
      expect(document.activeElement).toBe(field);
      // The same sentence again skips the model.
      fireEvent.submit(field.closest('form')!);
      await waitFor(() =>
        expect(screen.getByTestId('plan-say')).toHaveTextContent('Ich kann: Tag frei'),
      );
      expect(fake.requests).toHaveLength(1);
      expect(await db.table('todos_task').count()).toBe(1);

      // (b) A sentence the rules saw no instruction in, but the model did: discard → the next „Eintragen“ makes the ToDo.
      fake = model(() => JSON.stringify({ ops: [{ op: 'pin', key: 'k1', value: '2026-11-13' }] }));
      await useLocalModel.getState().refresh();
      fireEvent.change(field, { target: { value: 'Steuer lieber am Freitag' } });
      fireEvent.submit(field.closest('form')!);
      expect(await screen.findByTestId('plan-preview')).toHaveTextContent(
        'Steuer festgenagelt auf Fr',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
      expect(screen.getByTestId('plan-say')).toHaveTextContent(
        'Verworfen. Noch einmal „Eintragen“ legt ein ToDo an.',
      );
      fireEvent.submit(field.closest('form')!);
      await waitFor(async () => expect(await db.table('todos_task').count()).toBe(2));
      expect(fake.requests).toHaveLength(1);
      expect(screen.queryByTestId('plan-say')).toBeNull();

      // (c) A sentence the model reads as "no instruction" becomes a ToDo at once, no status line stays behind.
      fake = model(() => JSON.stringify({ ops: [] }));
      await useLocalModel.getState().refresh();
      fireEvent.change(field, { target: { value: 'Steuer Unterlagen sortieren' } });
      fireEvent.submit(field.closest('form')!);
      await waitFor(async () => expect(await db.table('todos_task').count()).toBe(3));
      expect(fake.requests).toHaveLength(1);
      await waitFor(() => expect(screen.queryByTestId('plan-say')).toBeNull());
      expect(screen.queryByTestId('plan-preview')).toBeNull();

      // (d) Escape while the model reads: the wait ends, the sentence stays, one line says what is next.
      fake = model(() => JSON.stringify({ ops: [{ op: 'pin', key: 'k1', value: '2026-11-13' }] }));
      // A generation that only ends when the signal aborts (a slow shell).
      fake.generate = (_req, opts) =>
        new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () => reject(new Error('cancelled')));
        });
      await useLocalModel.getState().refresh();
      fireEvent.change(field, { target: { value: 'Steuer erst nach dem Umzug' } });
      // A mouse user: the click lands on the button, which is disabled while the model reads.
      fireEvent.click(screen.getByRole('button', { name: 'Eintragen' }));
      await waitFor(() =>
        expect(screen.getByTestId('plan-say')).toHaveTextContent(
          'das lokale Modell liest den Satz',
        ),
      );
      expect(field).toHaveAttribute('readonly');
      expect(screen.getByRole('button', { name: 'Eintragen' })).toBeDisabled();
      fireEvent.keyDown(document.body, { key: 'Escape' });
      await waitFor(() =>
        expect(screen.getByTestId('plan-say')).toHaveTextContent(
          'Abgebrochen. Noch einmal „Eintragen“ legt ein ToDo an.',
        ),
      );
      expect(field).toHaveValue('Steuer erst nach dem Umzug');
      expect(field).not.toHaveAttribute('readonly');
      expect(document.activeElement).toBe(field);
      expect(screen.queryByTestId('plan-preview')).toBeNull();
      expect(await db.table('todos_task').count()).toBe(3);
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

  /** `n` ToDos planned on `date`, 10 min each, in order. */
  const plan = async (date: string, n: number) => {
    for (let i = 0; i < n; i++) {
      const task = await taskRepo.create({
        listId: 'inbox',
        title: `Ding ${i + 1}`,
        done: false,
        priority: 0,
        order: i,
        estimateMin: 10,
      });
      await assignmentRepo.upsert(`todos:${task.id}#0`, {
        itemKey: `todos:${task.id}`,
        k: 0,
        of: 1,
        date,
        minutes: 10,
        order: i,
        reason: 'new',
      });
    }
  };

  it('opens on the first day that holds things; today, picked, says where they are', async () => {
    await plan('2026-11-11', 2);
    draw();
    // Monday is today and empty: the sheet shows Wednesday, the band marks it.
    const sheet = await screen.findByTestId('day-2026-11-11');
    expect(within(sheet).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Mittwoch, 11. November',
    );
    const tiles = within(screen.getByRole('group', { name: 'Woche' })).getAllByRole('button');
    expect(tiles[2]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('planner-empty')).toBeNull();
    fireEvent.click(tiles[0]!);
    expect(await screen.findByTestId('planner-empty-day')).toHaveTextContent(
      'Heute ist frei. Der nächste Tag mit Dingen ist Mittwoch.',
    );
    fireEvent.click(tiles[1]!);
    expect(screen.getByTestId('planner-empty-day')).toHaveTextContent(
      'Für diesen Tag ist nichts geplant.',
    );
  });

  it('„Zuerst“ holds three rows, „Danach“ five and „n weitere“; a fold never hides fewer than two', async () => {
    await plan('2026-11-09', 12);
    draw();
    const sheet = await screen.findByTestId('day-2026-11-09');
    await within(sheet).findByText('Ding 1');
    expect(
      within(within(sheet).getByRole('list', { name: 'Zuerst' })).getAllByRole('listitem'),
    ).toHaveLength(3);
    const then = within(sheet).getByRole('button', { name: /Danach · 9/ });
    expect(then).toHaveAttribute('aria-expanded', 'true');
    expect(within(sheet).getAllByRole('checkbox')).toHaveLength(8);
    const more = within(sheet).getByRole('button', { name: '4 weitere' });
    expect(more).not.toHaveAttribute('aria-expanded');
    fireEvent.click(more);
    expect(within(sheet).getAllByRole('checkbox')).toHaveLength(12);
    expect(within(sheet).queryByRole('button', { name: /weitere/ })).toBeNull();
    // The fold of „Danach“ is kept on this device.
    fireEvent.click(then);
    await waitFor(() => expect(then).toHaveAttribute('aria-expanded', 'false'));
    expect(within(sheet).getAllByRole('checkbox')).toHaveLength(3);
    expect(await getMeta(THEN_WIDE_KEY)).toBe(false);
    // The foot offers the two steps of a day (the tick itself – one tap – is measured in e2e, path A).
    expect(within(sheet).getByRole('button', { name: 'Rest verteilen' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Tage einteilen' })).toBeInTheDocument();
    expect(within(sheet).getByRole('checkbox', { name: 'Erledigt: Ding 1' })).not.toBeChecked();
  });

  it('nine rows show in full: three first, six after (hiding one would hide fewer than two)', async () => {
    await plan('2026-11-09', 9);
    draw();
    const sheet = await screen.findByTestId('day-2026-11-09');
    await within(sheet).findByText('Ding 9');
    expect(within(sheet).getAllByRole('checkbox')).toHaveLength(9);
    expect(within(sheet).queryByRole('button', { name: /weitere/ })).toBeNull();
  });

  it('an example chip fills the field and focuses it; it never submits', async () => {
    draw();
    const field = await screen.findByLabelText('Eintragen oder sagen');
    expect(field).toHaveAttribute('placeholder', 'Was steht an?');
    const examples = screen.getByRole('group', { name: 'Zum Beispiel' });
    expect(
      within(examples)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Steuer 2 Std bis Do', 'Donnerstag frei', 'schieb Saugen auf Mi']);
    fireEvent.click(within(examples).getByRole('button', { name: 'Donnerstag frei' }));
    expect(field).toHaveValue('Donnerstag frei');
    expect(document.activeElement).toBe(field);
    expect(screen.queryByTestId('plan-preview')).toBeNull();
    expect(await dayRepo.get('2026-11-12')).toBeUndefined();
    expect(await db.table('todos_task').count()).toBe(0);
  });

  it('an entry that was not stored says so and keeps the text', async () => {
    draw();
    const field = await screen.findByLabelText('Eintragen oder sagen');
    // The planner is switched off behind the open page: nothing is stored.
    await db.table('_modules').put({
      id: 'planner',
      enabled: false,
      dataPolicy: null,
      createdAt: 1,
      updatedAt: 2,
      deviceId: 't',
      deletedAt: null,
      _f: {},
    });
    fireEvent.change(field, { target: { value: 'Keller aufräumen' } });
    fireEvent.submit(field.closest('form')!);
    const error = await screen.findByRole('alert');
    expect(screen.getByTestId('planner-add-error')).toBe(error);
    expect(error).toHaveTextContent(
      'Das habe ich nicht gespeichert. Dein Text steht noch im Feld.',
    );
    expect(field).toHaveValue('Keller aufräumen');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAttribute('aria-describedby', error.id);
    // Typing again takes the message away.
    fireEvent.change(field, { target: { value: 'Keller' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  describe('phone', () => {
    // The window says „phone“ (`PHONE_QUERY`); everything else does not match.
    beforeEach(() => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query === '(max-width: 899px)',
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }));
    });
    afterEach(() => vi.unstubAllGlobals());

    it('`?new=1` opens the capture sheet with the field in it – on arrival and on a page that is already there', async () => {
      const view = render(
        <MemoryRouter initialEntries={['/planner?new=1']}>
          <PlannerPage />
        </MemoryRouter>,
      );
      const sheet = await screen.findByRole('dialog', { name: 'Eintragen oder sagen' });
      expect(
        within(sheet).getByRole('textbox', { name: 'Eintragen oder sagen' }),
      ).toBeInTheDocument();
      // The examples stand in the sheet; the page's own last-row field steps back while it is open.
      expect(within(sheet).getByRole('group', { name: 'Zum Beispiel' })).toBeInTheDocument();
      expect(screen.getAllByRole('textbox', { name: 'Eintragen oder sagen' })).toHaveLength(1);
      view.unmount();

      render(
        <MemoryRouter initialEntries={['/planner']}>
          <Link to="/planner?new=1">quick add</Link>
          <PlannerPage />
        </MemoryRouter>,
      );
      // Mounted without the parameter: no sheet, the field is the page's last row, without examples.
      await screen.findByRole('group', { name: 'Woche' });
      expect(screen.queryByRole('dialog', { name: 'Eintragen oder sagen' })).toBeNull();
      expect(screen.getByRole('textbox', { name: 'Eintragen oder sagen' })).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Zum Beispiel' })).toBeNull();
      fireEvent.click(screen.getByRole('link', { name: 'quick add' }));
      expect(
        await screen.findByRole('dialog', { name: 'Eintragen oder sagen' }),
      ).toBeInTheDocument();
    });

    it('the page’s ⋯ stands beside the day title; the foot has no second „Tage einteilen“', async () => {
      await plan('2026-11-09', 5);
      draw();
      const sheet = await screen.findByTestId('day-2026-11-09');
      await within(sheet).findByText('Ding 1');
      expect(within(sheet).getByRole('button', { name: 'Weitere Optionen' })).toBeInTheDocument();
      expect(within(sheet).getByRole('button', { name: 'Rest verteilen' })).toBeInTheDocument();
      expect(within(sheet).queryByRole('button', { name: 'Tage einteilen' })).toBeNull();
      // „Danach“ is folded on the phone until the user opens it.
      const then = within(sheet).getByRole('button', { name: /Danach · 2 Dinge/ });
      expect(then).toHaveAttribute('aria-expanded', 'false');
      expect(within(sheet).getAllByRole('checkbox')).toHaveLength(3);
    });
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
