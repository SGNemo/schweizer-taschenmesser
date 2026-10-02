import { parseLines } from '@/core/io/textLines';
import type { ImportCandidate, ImporterRuntime } from '@/core/importer/types';
import { t } from '@/strings';
import { PACKING_TEMPLATES, parseEntry, type PackingTemplate } from './logic';
import { ensureShoppingList, itemRepo, listRepo } from './repo';
import { SHOPPING_LIST_ID } from './schema';

const key = (a: string, b = '') => `${a.trim().toLowerCase()}/${b.trim().toLowerCase()}`;
const s = t.onboarding.lists;

const runtime: ImporterRuntime = {
  async parse(id, input, ctx) {
    if (id === 'text' && input.kind === 'text') {
      await ensureShoppingList();
      return {
        candidates: parseLines(input.text, { max: 500 }).map((line, i): ImportCandidate => {
          const { name, quantity } = parseEntry(line);
          return {
            collection: 'item',
            data: {
              listId: SHOPPING_LIST_ID,
              name,
              done: false,
              order: i,
              ...(quantity ? { quantity } : {}),
            },
            label: name,
            ...(quantity ? { detail: quantity } : {}),
            dedupeKey: key(t.lists.defaultShopping, name),
          };
        }),
        notes: [],
      };
    }
    if (id === 'templates' && input.kind === 'template') {
      const candidates: ImportCandidate[] = [];
      const lists = await listRepo.active().toArray();
      let order = lists.reduce((max, l) => Math.max(max, l.order), 0);
      for (const tplId of input.ids.filter((x): x is PackingTemplate =>
        (PACKING_TEMPLATES as readonly string[]).includes(x),
      )) {
        const tpl = s[tplId];
        // The list candidate gets a fixed id so its items can point at it.
        const listId = `imp-${ctx.batchId}-${tplId}`;
        candidates.push({
          collection: 'list',
          id: listId,
          data: {
            name: tpl.name,
            kind: 'packing',
            order: ++order,
            ...(tpl.note ? { note: tpl.note } : {}),
          },
          label: tpl.name,
          detail: s.packingKind,
          dedupeKey: key(tpl.name),
        });
        tpl.items.forEach((name, i) =>
          candidates.push({
            collection: 'item',
            data: { listId, name, done: false, order: i },
            label: name,
            detail: tpl.name,
            dedupeKey: key(tpl.name, name),
          }),
        );
      }
      return { candidates, notes: [] };
    }
    return { candidates: [], notes: [] };
  },
  async existingKeys(collection) {
    const lists = await listRepo.active().toArray();
    if (collection === 'list') return new Set(lists.map((l) => key(l.name)));
    const names = new Map(lists.map((l) => [l.id, l.name]));
    const items = await itemRepo.active().toArray();
    return new Set(
      items
        // An open shopping entry counts as present; for other lists every entry does.
        .filter((i) => !i.done || names.get(i.listId) !== t.lists.defaultShopping)
        .map((i) => key(names.get(i.listId) ?? '', i.name)),
    );
  },
};

export default runtime;
