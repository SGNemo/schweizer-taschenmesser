import { t } from '@/strings';
import type { AppMigration } from './appMigrations';
import { tableName } from './schema';

const SHOPPING_ITEM = tableName('shopping', 'item');
const PACKING_LIST = tableName('packing', 'list');
const PACKING_ITEM = tableName('packing', 'item');
const LAUNCHER_LINK = tableName('launcher', 'link');
const LISTS_LIST = tableName('lists', 'list');
const LISTS_ITEM = tableName('lists', 'item');
const BOOKMARKS_ITEM = tableName('bookmarks', 'item');
const CONTRACTS_CONTRACT = tableName('contracts', 'contract');
const VAULT_DOCUMENT = tableName('vault', 'document');
const BIRTHDAYS_BIRTHDAY = tableName('birthdays', 'birthday');
const GIFTS_IDEA = tableName('gifts', 'idea');
const PEOPLE_PERSON = tableName('people', 'person');
const PEOPLE_GIFT = tableName('people', 'gift');
const REMINDERS_REMINDER = tableName('reminders', 'reminder');
const CALENDAR_EVENT = tableName('calendar', 'event');

/** Id of the shopping list that exists from the start (`modules/lists/schema.ts`). */
const SHOPPING_LIST_ID = 'shopping-default';

/** Same person under different spellings: trimmed, lower case, one space ("Anna  Beispiel " = "anna beispiel"). */
const nameKey = (v: unknown): string =>
  typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').toLowerCase() : '';

/** Id of a person that exists only because a gift names them (`person-<slug>`, same on every device). */
export function personIdFor(key: string): string {
  const slug = key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `person-${slug || 'unbekannt'}`;
}

interface GiftContext {
  /** name key → id of the birthday (= person) with that name; the smallest id when several. */
  byName: Map<string, string>;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

/**
 * Every app migration, oldest first. Steps are added with the package that merges or retires a
 * module; the old tables stay until package 6 (older devices keep writing to them).
 */
export const APP_MIGRATIONS: readonly AppMigration[] = [
  // 0.5.0 – Einkauf, Packlisten → Listen
  {
    id: '0.5.0-shopping-item',
    source: SHOPPING_ITEM,
    target: LISTS_ITEM,
    ensure: () => [
      {
        table: LISTS_LIST,
        id: SHOPPING_LIST_ID,
        fields: { name: t.lists.defaultShopping, kind: 'shopping', order: 0 },
      },
    ],
    map: (row) => ({
      id: row.id,
      // Old order = creation order; the list keeps it (open entries first, then by this key).
      fields: {
        listId: SHOPPING_LIST_ID,
        name: row.name,
        quantity: str(row.quantity),
        done: row.done === true,
        // Whole, non-negative: keeps the sort key stable across devices.
        order: Math.max(0, Math.trunc(Number(row.createdAt) || 0)),
      },
      from: { name: 'name', quantity: 'quantity', done: 'done' },
    }),
  },
  {
    id: '0.5.0-packing-list',
    source: PACKING_LIST,
    target: LISTS_LIST,
    map: (row) => ({
      id: row.id,
      fields: {
        name: row.name,
        kind: 'packing',
        note: str(row.note),
        order: Math.max(1, Math.trunc(Number(row.createdAt) || 1)),
      },
      from: { name: 'name', note: 'note' },
    }),
  },
  {
    id: '0.5.0-packing-item',
    source: PACKING_ITEM,
    target: LISTS_ITEM,
    map: (row) => ({
      id: row.id,
      fields: {
        listId: row.listId,
        name: row.name,
        done: row.packed === true,
        order: typeof row.order === 'number' ? row.order : 0,
      },
      from: { listId: 'listId', name: 'name', done: 'packed', order: 'order' },
    }),
  },
  // 0.5.0 – Apps & Links → Merkliste (Art „Lesezeichen“)
  {
    id: '0.5.0-launcher-link',
    source: LAUNCHER_LINK,
    target: BOOKMARKS_ITEM,
    map: (row) => ({
      id: row.id,
      fields: {
        title: row.title,
        url: row.url,
        kind: 'link',
        tags: str(row.group) ? [str(row.group)!.trim()] : [],
        done: false,
      },
      from: { title: 'title', url: 'url', tags: 'group' },
    }),
  },
  // 0.6.0 – Verträge & Garantien → Unterlagen
  {
    id: '0.6.0-contract',
    source: CONTRACTS_CONTRACT,
    target: VAULT_DOCUMENT,
    map: (row) => ({
      id: row.id,
      fields: {
        title: row.name,
        category: row.kind,
        provider: str(row.provider),
        startDate: str(row.startDate),
        endDate: str(row.endDate),
        noticeDays: typeof row.noticeDays === 'number' ? row.noticeDays : undefined,
        note: str(row.note),
      },
      from: { title: 'name', category: 'kind' },
    }),
  },
  // 0.6.0 – Geburtstage, Geschenkideen → Personen
  {
    id: '0.6.0-birthday',
    source: BIRTHDAYS_BIRTHDAY,
    target: PEOPLE_PERSON,
    map: (row) => ({
      id: row.id,
      fields: {
        name: row.name,
        birthday: {
          month: row.month,
          day: row.day,
          ...(typeof row.year === 'number' ? { year: row.year } : {}),
        },
        note: str(row.note),
        tags: [],
      },
      from: { name: 'name', note: 'note' },
    }),
  },
  {
    id: '0.6.0-gift',
    source: GIFTS_IDEA,
    target: PEOPLE_GIFT,
    // A gift belongs to the person (former birthday) with the same name, otherwise to a person that
    // is made up for the name. The match reads the birthday rows, so the birthday step comes first.
    prepare: async (database) => {
      const rows = (await database.table(BIRTHDAYS_BIRTHDAY).toArray()).filter(
        (r) => r.deletedAt === null,
      ) as { id: string; name: string }[];
      const byName = new Map<string, string>();
      for (const r of rows.sort((a, b) => a.id.localeCompare(b.id))) {
        const key = nameKey(r.name);
        if (key && !byName.has(key)) byName.set(key, r.id);
      }
      return { byName } satisfies GiftContext;
    },
    ensure: (rows, ctx) => {
      const { byName } = ctx as GiftContext;
      const wanted = new Map<string, string>();
      const live = rows
        .filter((r) => r.deletedAt === null)
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      for (const r of live) {
        const key = nameKey(r.forWhom);
        if (key && !byName.has(key) && !wanted.has(key)) wanted.set(key, String(r.forWhom).trim());
      }
      return [...wanted].map(([key, name]) => ({
        table: PEOPLE_PERSON,
        id: personIdFor(key),
        fields: { name, tags: [] },
      }));
    },
    map: (row, ctx) => {
      const key = nameKey(row.forWhom);
      if (!key) return undefined;
      const personId = (ctx as GiftContext).byName.get(key) ?? personIdFor(key);
      return {
        id: row.id,
        fields: {
          personId,
          title: row.title,
          occasion: str(row.occasion),
          date: str(row.date),
          priceCents: typeof row.priceCents === 'number' ? row.priceCents : undefined,
          url: str(row.url),
          status: row.status,
          note: str(row.note),
        },
        from: { personId: 'forWhom' },
      };
    },
  },
  // 0.7.0 – Erinnerungen → Kalender (Termine der Art „Erinnerung“)
  {
    id: '0.7.0-reminder',
    source: REMINDERS_REMINDER,
    target: CALENDAR_EVENT,
    map: (row) => ({
      id: row.id,
      fields: {
        title: row.title,
        kind: 'reminder',
        allDay: false,
        startDate: row.startDate,
        startTime: str(row.time) ?? '09:00',
        note: str(row.note),
        recurrence: row.recurrence ?? undefined,
        // Paused (`active` off) = notification off; the reminder keeps its own time of day.
        notify: { minutesBefore: 0, enabled: row.active !== false },
      },
      from: { startTime: 'time', notify: 'active' },
    }),
  },
];
