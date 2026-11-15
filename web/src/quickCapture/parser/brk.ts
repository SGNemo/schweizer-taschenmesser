/**
 * „Pause …“ / „Freizeit …“ (use case „Wochenende retten“, F2): while the planner is on, a line that starts with one of
 * these words is a break – a blocker of its day, never a ToDo. Day = the typed date ?? today; length = the typed
 * range or duration ?? 60 min; a time only when typed. The rest of the line is its label (or the word itself). A
 * bare „Zocken“ stays a ToDo: the app never guesses what is leisure. Pure.
 */
import { extractDateTime } from './dates';
import { extractEndTime } from './endtime';
import { extractEstimate } from './estimate';
import type { CaptureResult, ParseOptions } from './types';
import { fmtDate, fromDate, type Scan } from './util';

const BREAK_START = /^\s*(pause|freizeit)\b[\s:,–-]*/i;

/** A line that starts with „Pause“/„Freizeit“ (with the planner off it is a ToDo, never an appointment). */
export const isBreakLine = (text: string): boolean => BREAK_START.test(text);

/** A bare short weekday in a break line („Freizeit Sa 2 Std“): the date reader knows the long names. */
const SHORT: Record<string, string> = {
  mo: 'Montag',
  di: 'Dienstag',
  mi: 'Mittwoch',
  do: 'Donnerstag',
  fr: 'Freitag',
  sa: 'Samstag',
  so: 'Sonntag',
};
/** Only a capitalised one („Sa“, „So.“) or one with a period („so.“): a plain „so“ or „do“ is a word, never a day. */
const SHORT_DAY =
  /(?<![\p{L}\d])(?:(Mo|Di|Mi|Do|Fr|Sa|So)\.?|(mo|di|mi|do|fr|sa|so)\.)(?![\p{L}\d])/gu;

export function parseBreak(input: string, opts: ParseOptions): CaptureResult | undefined {
  if (!opts.breaks) return undefined;
  const m = BREAK_START.exec(input);
  if (!m) return undefined;
  const scan: Scan = {
    t: input
      .slice(m[0].length)
      .replace(SHORT_DAY, (_, a?: string, b?: string) => SHORT[(a ?? b)!.toLowerCase()]!),
  };
  const endTime = extractEndTime(scan);
  const estimate = extractEstimate(scan);
  const dt = extractDateTime(scan, opts.now);
  const word = m[1]!;
  const label = scan.t.replace(/\s+/g, ' ').trim();
  const time = dt.time;
  return {
    type: 'break',
    fields: {
      title: label || word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      date: fmtDate(dt.date ?? fromDate(opts.now)),
      ...(time !== undefined ? { time } : {}),
      ...(time !== undefined && endTime ? { endTime } : {}),
      ...(estimate !== undefined ? { estimateMin: estimate } : {}),
    },
    confidence: 0.95,
    needsChoice: false,
    forced: true,
    alternatives: [{ type: 'todo', confidence: 0.3 }],
    notes: [],
  };
}
