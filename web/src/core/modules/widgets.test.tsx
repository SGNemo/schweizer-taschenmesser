// @vitest-environment jsdom
/**
 * Widget contract for every registered module (new modules are picked up automatically):
 * each widget renders without data (empty state with a link as next step) and with the module's
 * example data, without errors.
 */
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { buildExample } from '@/core/dataapi/example';
import { createJsonRuntime } from '@/core/dataapi/importer';
import { isDataApiModule } from '@/core/dataapi/scope';
import { commitImport } from '@/core/importer/batches';
import { buildPreview } from '@/core/importer/plan';
import { widgetsOf } from '@/home/AutoWidget';
import { setNow } from '@/core/time/now';
import { allManifests, visibleManifests } from './registry';

const cases = visibleManifests.flatMap((m) =>
  widgetsOf(m).map((w) => [`${m.id}:${w.id}`, m, w] as const),
);

beforeEach(async () => {
  setNow(() => new Date(2026, 8, 29, 10, 0).getTime());
  for (const m of allManifests)
    for (const c of Object.keys(m.dataSchema.collections)) await db.table(`${m.id}_${c}`).clear();
  await db.table('_outbox').clear();
  await db.table('_imports').clear();
});
afterEach(() => {
  setNow();
  vi.restoreAllMocks();
});

async function renderWidget(w: (typeof cases)[number][2]) {
  const { default: Widget } = await w.component();
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const view = render(
    <MemoryRouter>
      <Widget />
    </MemoryRouter>,
  );
  return { ...view, errors };
}

describe('every module offers a valid widget', () => {
  it.each(visibleManifests.map((m) => [m.id, m] as const))('%s declares at least one', (_id, m) => {
    expect(m.widgets.length).toBeGreaterThan(0);
    for (const w of m.widgets) {
      expect(w.id).toBeTruthy();
      expect(w.title).toBeTruthy();
      expect(w.sizes).toContain(w.defaultSize);
    }
  });
});

describe('widgets render', () => {
  it.each(cases)('%s without data (empty state with a next step)', async (_key, m, w) => {
    const { container, errors } = await renderWidget(w);
    const hasData = Object.keys(m.dataSchema.collections).length > 0;
    if (hasData) await waitFor(() => expect(container.querySelector('a')).not.toBeNull());
    else await waitFor(() => expect(container.textContent).not.toBe(''));
    expect(errors).not.toHaveBeenCalled();
  });

  it.each(cases.filter(([, m]) => isDataApiModule(m)))(
    '%s with example data',
    async (_key, m, w) => {
      const runtime = createJsonRuntime(m);
      const parsed = await runtime.parse(
        'json',
        { kind: 'json', text: JSON.stringify({ items: buildExample(m) }) },
        { today: '2026-09-29', options: {}, batchId: 'w' },
      );
      const rows = await buildPreview(m, runtime, parsed.candidates);
      await commitImport(m, { batchId: 'w', importerId: 'json', source: 'x', rows });
      const { container, errors } = await renderWidget(w);
      await waitFor(() => expect(container.textContent?.trim()).not.toBe(''));
      expect(errors).not.toHaveBeenCalled();
    },
  );
});
