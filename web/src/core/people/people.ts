import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db/db';
import { tableName } from '@/core/db/schema';
import { compareText } from '@/core/i18n/format';
import { useModuleStates } from '@/core/modules/activation';

/** A person (or client) other modules can point at: just the id and the name, read-only. */
export interface PersonRef {
  id: string;
  name: string;
}

/**
 * The people a ToDo or an appointment can be assigned to ("Für"). Reads the People module's table
 * directly so that no module imports another one; empty while the module is off.
 */
export function usePeople(): PersonRef[] | undefined {
  const states = useModuleStates();
  const on = states?.people === true;
  return useLiveQuery(async () => {
    if (!states) return undefined;
    if (!on) return [];
    const rows = (await db.table(tableName('people', 'person')).toArray()) as {
      id: string;
      name: string;
      deletedAt: number | null;
    }[];
    return rows
      .filter((p) => p.deletedAt === null)
      .map((p) => ({ id: p.id, name: p.name }))
      .sort((a, b) => compareText(a.name, b.name));
  }, [on, states === undefined]);
}

export const personName = (
  people: readonly PersonRef[] | undefined,
  id: string | undefined,
): string | undefined => (id ? people?.find((p) => p.id === id)?.name : undefined);
