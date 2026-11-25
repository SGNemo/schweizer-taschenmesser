import { bus } from '@/core/events';
import { today } from '@/core/time/dates';
import { newRoutine, parseSteps } from './logic';
import { routineRepo } from './repo';

/**
 * A routine from a checklist (`routine.requested`): the name and its lines as steps, every week from today, so it
 * shows under „Dran“ to be adjusted. A routine of the same name (ignoring case) is left alone: asking twice never
 * makes two. The checklist is not touched (nothing is moved or deleted by code).
 */
export async function addRequested(req: {
  name: string;
  steps: string[];
}): Promise<string | undefined> {
  const name = req.name.trim().slice(0, 120);
  if (!name) return undefined;
  const key = name.toLocaleLowerCase();
  const existing = await routineRepo.active().toArray();
  if (existing.some((r) => r.name.trim().toLocaleLowerCase() === key)) return undefined;
  const steps = parseSteps(req.steps.join('\n'), [], () => crypto.randomUUID().slice(0, 8));
  const created = await routineRepo.create(
    newRoutine({
      name,
      room: '',
      repeat: { freq: 'weekly', interval: 1 },
      people: '',
      dueDate: today(),
      note: '',
      steps,
    }),
  );
  return created.id;
}

/**
 * Runs while the routines module is enabled: reacts to `routine.requested`. The handler hands back the write's promise,
 * so whoever awaits the emit waits for the routine (the planner's „Als Routine speichern“, package 5a).
 */
export default function start(): () => void {
  return bus.on('routine.requested', (req) => addRequested(req).then(() => undefined));
}
