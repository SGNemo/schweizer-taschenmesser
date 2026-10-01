import { isoWeekday } from '@/core/time/dates';
import type { SeedContext, SeedModule, SeedRow, SeedRows } from '@/core/seed/types';

const PROJECTS = [
  'Website-Relaunch',
  'Buchhaltung',
  'Weiterbildung',
  'Interne Meetings',
  'Vereinsarbeit',
  'Beratung Kunde Beispiel',
];
const NOTES = [
  'Konzept',
  'Umsetzung',
  'Abstimmung',
  'Recherche',
  'Dokumentation',
  'Fehlersuche',
  'Review',
  'Planung',
];
const MINUTES = [30, 45, 60, 90, 120, 150, 180, 240];

function seed(ctx: SeedContext): SeedRows {
  const nProjects = ctx.count({ small: 3, medium: 4, large: 6 });
  const days = ctx.count({ small: 14, medium: 35, large: 365 });
  const projects: SeedRow[] = PROJECTS.slice(0, nProjects).map((name, i) => ({
    id: ctx.id('timetrack', 'project', i),
    data: { name, archived: false },
  }));
  const entries: SeedRow[] = [];
  let n = 0;
  for (let back = 0; back < days; back++) {
    const date = ctx.day(-back);
    const wd = isoWeekday(date);
    // Mostly working days; the current week always has entries so the widget shows a total.
    if (wd >= 6 && !ctx.rng.chance(0.1)) continue;
    const blocks = ctx.rng.int(1, 3);
    for (let b = 0; b < blocks; b++) {
      const project = ctx.rng.pick(projects);
      entries.push({
        id: ctx.id('timetrack', 'entry', n++),
        data: {
          projectId: project.id,
          date,
          minutes: ctx.rng.pick(MINUTES),
          ...(ctx.rng.chance(0.7) ? { note: ctx.rng.pick(NOTES) } : {}),
        },
      });
    }
  }
  return { project: projects, entry: entries };
}

export default { seed } satisfies SeedModule;
