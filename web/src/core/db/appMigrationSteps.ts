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

/** Id of the shopping list that exists from the start (`modules/lists/schema.ts`). */
const SHOPPING_LIST_ID = 'shopping-default';

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
];
