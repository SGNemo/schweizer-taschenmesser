import { useLiveQuery } from 'dexie-react-hooks';
import type { Stored } from '@/core/db/types';
import { clientRepo, jobRepo, sessionRepo } from './repo';
import type { Client, Job, Session } from './schema';

/** Jobs in the user's order; archived ones only when asked for. */
export function useJobs(archived = false): Stored<Job>[] | undefined {
  return useLiveQuery(
    async () =>
      (await jobRepo.active().sortBy('order')).filter((j) => Boolean(j.archived) === archived),
    [archived],
  );
}

export function useClients(): Stored<Client>[] | undefined {
  return useLiveQuery(() => clientRepo.active().sortBy('order'), []);
}

/** Sessions that started on or after `from` (a day string), newest first. */
export function useSessions(from: string): Stored<Session>[] | undefined {
  return useLiveQuery(
    async () =>
      (await sessionRepo.active().toArray())
        .filter((s) => s.date >= from || !s.endTime)
        .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime)),
    [from],
  );
}
