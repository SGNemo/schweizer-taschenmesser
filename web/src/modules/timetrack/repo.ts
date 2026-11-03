import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import type { Stored } from '@/core/db/types';
import { toDateString } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { elapsedBreak, hhmm, runningSession } from './logic';
import { clientSchema, jobSchema, sessionSchema, type Session } from './schema';

export const clientRepo = createRepo(tableName('timetrack', 'client'), clientSchema);
export const jobRepo = createRepo(tableName('timetrack', 'job'), jobSchema);
export const sessionRepo = createRepo(tableName('timetrack', 'session'), sessionSchema);

const stamp = (ms: number) => ({ date: toDateString(new Date(ms)), time: hhmm(ms) });

/** The running session, if any (there is never more than one). */
export async function getRunning(): Promise<Stored<Session> | undefined> {
  return runningSession(await sessionRepo.active().toArray());
}

/** Stops a running session now; a paused one ends where its pause began (the pause is not work). */
export async function stopSession(session: Stored<Session>, at: number = now()): Promise<void> {
  if (session.endTime) return;
  const end =
    session.pausedAt && session.pausedDate
      ? { date: session.pausedDate, time: session.pausedAt }
      : stamp(at);
  await sessionRepo.update(session.id, {
    endTime: end.time,
    endDate: end.date !== session.date ? end.date : undefined,
    pausedAt: undefined,
    pausedDate: undefined,
  });
}

/** One click: stops whatever runs and starts a session on `jobId` (or without a project). */
export async function startSession(
  jobId: string | undefined,
  opts: { from?: string; note?: string; at?: number } = {},
): Promise<Stored<Session>> {
  const at = opts.at ?? now();
  const running = await getRunning();
  if (running) await stopSession(running, at);
  const s = stamp(at);
  return sessionRepo.create({
    jobId,
    date: s.date,
    startTime: s.time,
    breakMin: 0,
    ...(opts.from ? { from: opts.from } : {}),
    ...(opts.note ? { note: opts.note } : {}),
  });
}

export async function pauseSession(session: Stored<Session>, at: number = now()): Promise<void> {
  if (session.endTime || session.pausedAt) return;
  const s = stamp(at);
  await sessionRepo.update(session.id, { pausedDate: s.date, pausedAt: s.time });
}

/** Resumes: the minutes of the pause move into the break. */
export async function resumeSession(session: Stored<Session>, at: number = now()): Promise<void> {
  if (!session.pausedAt) return;
  await sessionRepo.update(session.id, {
    breakMin: session.breakMin + elapsedBreak(session, at),
    pausedAt: undefined,
    pausedDate: undefined,
  });
}
