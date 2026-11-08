/**
 * The built-in exercise catalogue (package 4): ~40 common exercises in eight groups, each with the movement
 * pattern its pictogram shows. Names come from the strings (`t.fitness.catalog.names`), so they follow the UI
 * language; own exercises stay free text. Pure data, no user data.
 */
import { t } from '@/strings';

export const GROUPS = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'cardio',
  'mobility',
] as const;
export type Group = (typeof GROUPS)[number];

/** Movement patterns = pictograms (`components/ExercisePicto.tsx`); `other` is the dumbbell. */
export const PATTERNS = [
  'press',
  'overhead',
  'row',
  'pullup',
  'squat',
  'hinge',
  'lunge',
  'curl',
  'core',
  'run',
  'bike',
  'swim',
  'stretch',
  'other',
] as const;
export type Pattern = (typeof PATTERNS)[number];

export const CATALOG = [
  { id: 'benchPress', group: 'chest', pattern: 'press' },
  { id: 'inclineBench', group: 'chest', pattern: 'press' },
  { id: 'dumbbellPress', group: 'chest', pattern: 'press' },
  { id: 'pushUp', group: 'chest', pattern: 'press' },
  { id: 'dips', group: 'chest', pattern: 'press' },
  { id: 'flyes', group: 'chest', pattern: 'press' },
  { id: 'pullUp', group: 'back', pattern: 'pullup' },
  { id: 'latPulldown', group: 'back', pattern: 'pullup' },
  { id: 'row', group: 'back', pattern: 'row' },
  { id: 'dumbbellRow', group: 'back', pattern: 'row' },
  { id: 'deadlift', group: 'back', pattern: 'hinge' },
  { id: 'backExtension', group: 'back', pattern: 'hinge' },
  { id: 'squat', group: 'legs', pattern: 'squat' },
  { id: 'legPress', group: 'legs', pattern: 'squat' },
  { id: 'lunge', group: 'legs', pattern: 'lunge' },
  { id: 'romanianDeadlift', group: 'legs', pattern: 'hinge' },
  { id: 'legCurl', group: 'legs', pattern: 'curl' },
  { id: 'calfRaise', group: 'legs', pattern: 'other' },
  { id: 'hipThrust', group: 'legs', pattern: 'hinge' },
  { id: 'shoulderPress', group: 'shoulders', pattern: 'overhead' },
  { id: 'lateralRaise', group: 'shoulders', pattern: 'other' },
  { id: 'facePull', group: 'shoulders', pattern: 'row' },
  { id: 'shrug', group: 'shoulders', pattern: 'other' },
  { id: 'bicepsCurl', group: 'arms', pattern: 'curl' },
  { id: 'hammerCurl', group: 'arms', pattern: 'curl' },
  { id: 'tricepsExtension', group: 'arms', pattern: 'overhead' },
  { id: 'plank', group: 'core', pattern: 'core' },
  { id: 'crunch', group: 'core', pattern: 'core' },
  { id: 'legRaise', group: 'core', pattern: 'core' },
  { id: 'russianTwist', group: 'core', pattern: 'core' },
  { id: 'run', group: 'cardio', pattern: 'run' },
  { id: 'walk', group: 'cardio', pattern: 'run' },
  { id: 'bike', group: 'cardio', pattern: 'bike' },
  { id: 'swim', group: 'cardio', pattern: 'swim' },
  { id: 'rowing', group: 'cardio', pattern: 'row' },
  { id: 'jumpRope', group: 'cardio', pattern: 'run' },
  { id: 'crossTrainer', group: 'cardio', pattern: 'run' },
  { id: 'stretch', group: 'mobility', pattern: 'stretch' },
  { id: 'yoga', group: 'mobility', pattern: 'stretch' },
  { id: 'foamRoll', group: 'mobility', pattern: 'stretch' },
] as const satisfies readonly { id: string; group: Group; pattern: Pattern }[];
export type CatalogId = (typeof CATALOG)[number]['id'];

/** The catalogue name of an entry in the UI language. */
export const catalogName = (id: CatalogId): string => t.fitness.catalog.names[id];

/** Every catalogue name in the UI language (suggestions in the form). */
export const catalogNames = (): string[] => CATALOG.map((e) => catalogName(e.id));

/** Words in an own exercise's name that tell its pattern („Kurzhantel-Rudern“, „Morning run“). */
const HINTS: [RegExp, Pattern][] = [
  [/klimmz|pull-?up|chin-?up|latzieh|pulldown/i, 'pullup'],
  [/rud|row|face ?pull/i, 'row'],
  [/kreuzheb|deadlift|hip ?thrust|rückenstreck|back ext|good ?morning/i, 'hinge'],
  [/kniebeug|squat|beinpress|leg press/i, 'squat'],
  [/ausfall|lunge|split/i, 'lunge'],
  [/curl|beinbeug/i, 'curl'],
  [/schulterdr|shoulder press|overhead|über kopf|military|trizeps|triceps/i, 'overhead'],
  [/plank|crunch|sit-?up|bauch|core|twist|beinheb|leg raise/i, 'core'],
  [/drück|press|liegest|push-?up|dips|butterfly|fly/i, 'press'],
  [/lauf|jogg|\brun|\bgeh|walk|wander|hike|seilspring|jump ?rope|cross ?trainer/i, 'run'],
  [/rad|bike|cycl|spinning|ergometer/i, 'bike'],
  [/schwimm|swim/i, 'swim'],
  [/dehn|stretch|yoga|mobil|faszien|foam|pilates/i, 'stretch'],
];

/** The pattern of an exercise: its catalogue entry, else a word in its name, else the dumbbell. */
export function patternOf(name: string): Pattern {
  const key = name.trim().toLocaleLowerCase();
  const hit = CATALOG.find((e) => catalogName(e.id).toLocaleLowerCase() === key);
  if (hit) return hit.pattern;
  return HINTS.find(([re]) => re.test(key))?.[1] ?? 'other';
}
