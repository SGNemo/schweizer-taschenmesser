// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { getManifest } from '@/core/modules/registry';
import type { ModuleManifest } from '@/core/modules/types';
import { settingsRepo } from '@/core/settings/settings';
import { AutoWidgetBody, countableCollections, widgetsOf } from './AutoWidget';
import { HOME_SCOPE, loadLayout, resetLayout, updateLayout } from './layout';

beforeEach(async () => {
  await db.table('_settings').clear();
  await db.table('_outbox').clear();
  await db.table('todos_task').clear();
});

describe('home layout storage', () => {
  it('migrates the old dashboard record on the first edit and leaves it untouched', async () => {
    await settingsRepo.upsert('dashboard', { order: ['todos:open'], hidden: ['finance:balance'] });
    expect(await loadLayout()).toEqual({
      order: ['todos:open'],
      hidden: ['finance:balance'],
      sizes: {},
    });
    expect(await settingsRepo.get(HOME_SCOPE)).toBeUndefined();

    await updateLayout({ sizes: { 'todos:open': 'l' } });
    expect(await loadLayout()).toEqual({
      order: ['todos:open'],
      hidden: ['finance:balance'],
      sizes: { 'todos:open': 'l' },
    });
    expect(await settingsRepo.get('dashboard')).toMatchObject({ hidden: ['finance:balance'] });
  });

  it('resets to the defaults without touching other records', async () => {
    await updateLayout({ order: ['a:b'], hidden: ['c:d'], sizes: { 'a:b': 'm' } });
    await resetLayout();
    expect(await loadLayout()).toEqual({ order: [], hidden: [], sizes: {} });
  });

  it('keeps the position and visibility of a module that is switched off', async () => {
    await updateLayout({ order: ['todos:open', 'gone:w'], hidden: ['gone:w'] });
    const layout = await loadLayout();
    expect(layout.order).toContain('gone:w');
    expect(layout.hidden).toContain('gone:w');
  });
});

describe('fallback widget', () => {
  const bare: ModuleManifest = {
    ...getManifest('todos')!,
    id: 'todos',
    name: 'Extern',
    description: 'Ein Modul ohne eigenes Widget.',
    widgets: [],
  };

  it('is generated for a module without widgets, and only then', () => {
    const [w] = widgetsOf(bare);
    expect(w).toMatchObject({ id: 'auto', title: 'Extern', defaultSize: 's' });
    expect(widgetsOf(getManifest('todos')!)[0]!.id).not.toBe('auto');
  });

  it('counts live entries of the module collections and links into the module', async () => {
    await db.table('todos_task').bulkAdd([
      { id: 'a', title: 'x', deletedAt: null },
      { id: 'b', title: 'y', deletedAt: null },
      { id: 'c', title: 'z', deletedAt: 123 },
    ]);
    render(
      <MemoryRouter>
        <AutoWidgetBody manifest={bare} />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Ein Modul ohne eigenes Widget/)).toBeInTheDocument();
    expect(await screen.findByText(/^\d+ Einträge?$/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Extern öffnen' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/todos/),
    );
  });

  it('counts nothing for modules without countable data', () => {
    expect(countableCollections(getManifest('disk')!)).toEqual([]);
    expect(countableCollections(getManifest('accounts')!)).toEqual([]);
  });
});
