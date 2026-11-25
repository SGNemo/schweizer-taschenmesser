/**
 * „Als Routine speichern“ for a thing with steps (planner hub 2, package 5a; COPY B16, B25, X7): the planner sends the
 * existing `routine.requested { name, steps }` – titles only travel – inside its own `act`, so one undo entry takes the
 * new routine back. Offered only while the routines module is on, and for a ToDo only when it is a plain task (no
 * legacy `links[]` entry, no `origin` link row – the rule of the URL chip: a mail ToDo's title is a subject, and
 * routines have a data API). The name is looked up first through the generic manifest repo (no module import): one of
 * that name exists → B25, nothing is sent; after sending, the same lookup confirms → B16, else X7.
 */
import { createCollectionRepo } from '@/core/db/repo';
import { linkEntries } from '@/core/entitylinks';
import { bus } from '@/core/events';
import { loadModuleStates } from '@/core/modules/activation';
import type { PlannableEntry } from '@/core/modules/contributions';
import { getManifest, visibleManifests } from '@/core/modules/registry';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { act } from './actions';

const ROUTINES = 'routines';
const ROUTINES_PATH = '/routines';
const same = (a: string, b: string) =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** Is the routines module on here? */
export async function routinesOn(): Promise<boolean> {
  return !!(await loadModuleStates(visibleManifests))[ROUTINES];
}

/** The routines module's name length (`routines/schema`); the event carries the name, the handler cuts it there. */
const ROUTINE_NAME_MAX = 120;

/** A live routine of that name (any case), read through the generic manifest repo. */
export async function routineNamed(name: string): Promise<boolean> {
  const manifest = getManifest(ROUTINES);
  if (!manifest) return false;
  const rows = (await createCollectionRepo(manifest, 'routine').active().toArray()) as {
    name?: unknown;
  }[];
  return rows.some((r) => typeof r.name === 'string' && same(r.name, name));
}

/**
 * Can this thing be saved as a routine? A ToDo with steps that is a plain task; nothing else (a list keeps its page's own
 * „Als Routine übernehmen“, a routine is one already).
 */
export async function canSaveAsRoutine(
  e: Pick<PlannableEntry, 'moduleId' | 'id' | 'kind' | 'steps' | 'link'>,
): Promise<boolean> {
  if (e.moduleId !== 'todos' || !e.steps?.length || e.link) return false;
  if (!(await routinesOn())) return false;
  const links = await linkEntries({ module: 'todos', id: e.id });
  return !links.some((l) => l.link.rel === 'origin');
}

/** B25 / B16 / X7; true when a routine was made. */
export async function saveAsRoutine(
  e: Pick<PlannableEntry, 'title' | 'steps'>,
  titles: Record<string, string>,
  /** Opens a route of the app („Ansehen“ → `/routines`): the page's `navigate`. */
  open: (path: string) => void,
): Promise<boolean> {
  // As the routine will be named (routines keeps 120 characters): the lookup must find what the handler writes.
  const name = e.title.trim().slice(0, ROUTINE_NAME_MAX);
  const steps = (e.steps ?? []).map((s) => s.title);
  const ansehen = { label: t.planner.steps.view, run: () => open(ROUTINES_PATH) };
  if (await routineNamed(name)) {
    useUiStore.getState().toast(t.planner.steps.routineExists(name), ansehen);
    return false;
  }
  try {
    return await act(
      t.planner.steps.asRoutine,
      t.planner.steps.routineMade(name),
      titles,
      async () => {
        await bus.emit('routine.requested', { name, steps });
        // The handler wrote nothing (it threw, or refused): nothing happened – said, and the act takes nothing back.
        if (!(await routineNamed(name))) throw new RoutineNotMade();
      },
      { leadOnly: true, view: ansehen },
    );
  } catch (err) {
    if (!(err instanceof RoutineNotMade)) throw err;
    useUiStore.getState().toast(t.planner.panel.failed);
    return false;
  }
}

class RoutineNotMade extends Error {}
