import type { ImportCandidate, ImporterRuntime } from '@/core/importer/types';
import { describeRecurrence } from '@/core/recurrence/describe';
import { addDaysStr, formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { routineRepo } from './repo';
import type { Routine } from './schema';
import { ROUTINE_TEMPLATES, type RoutineTemplateId } from './templates';

/** Same name (ignoring case) = the same routine: a template taken before is not offered twice. */
const keyOf = (name: string) => name.trim().toLowerCase();

const runtime: ImporterRuntime = {
  parse(_id, input, ctx) {
    if (input.kind !== 'template') return { candidates: [], notes: [] };
    const s = t.onboarding.routines;
    const candidates = input.ids
      .filter((id): id is RoutineTemplateId => Object.hasOwn(ROUTINE_TEMPLATES, id))
      .map((id): ImportCandidate => {
        const { name, room } = s.items[id];
        const { repeat, firstIn, minutes } = ROUTINE_TEMPLATES[id];
        const first = addDaysStr(ctx.today, firstIn);
        const data: Routine = {
          name,
          room: room || undefined,
          repeat,
          startDate: first,
          dueDate: first,
          people: [],
          turn: 0,
          minutes,
        };
        return {
          collection: 'routine',
          data,
          label: name,
          detail: [room, describeRecurrence(repeat), s.first(formatDay(first, 'EEE, d. MMM'))]
            .filter(Boolean)
            .join(' · '),
          dedupeKey: keyOf(name),
        };
      });
    return { candidates, notes: [] };
  },
  async existingKeys() {
    return new Set((await routineRepo.active().toArray()).map((r) => keyOf(r.name)));
  },
};

export default runtime;
