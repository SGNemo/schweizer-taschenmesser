// @vitest-environment jsdom
/**
 * Unterlagen in the palette and the quick capture (UI audit 2026-11, package 0b-2): documents stay searchable, a hit
 * names a document and is therefore shown without the reading aid, and nothing typed into the quick capture lands in
 * the vault by itself – a document is added only through the module's own entry.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { searchEntries } from '@/core/ai/search/fulltext';
import { db } from '@/core/db/db';
import { enableModule } from '@/core/modules/activation';
import { allManifests } from '@/core/modules/registry';
import { isCredentialPath } from '@/core/text/credentialPath';
import { ReadAidProvider } from '@/ui/ReadAidProvider';
import { setNow } from '@/core/time/now';
import { CommandPalette } from '@/layout/CommandPalette';
import { parseCapture } from '@/quickCapture/parser';
import { CORPUS, CORPUS_NOW } from '@/quickCapture/parser/corpus';
import { availableTypes, saveCapture, TARGETS, targetFor } from '@/quickCapture/targets';
import { useUiStore } from '@/stores/ui';
import manifest from '../manifest';
import { documentRepo } from '../repo';
import { documentSchema } from '../schema';

const TITLE = 'Mietvertrag Lindenstraße';

beforeEach(async () => {
  setNow(() => new Date(2026, 8, 29, 10, 0).getTime());
  localStorage.clear();
  for (const m of allManifests) {
    for (const c of Object.keys(m.dataSchema.collections)) await db.table(`${m.id}_${c}`).clear();
  }
  await db.table('_settings').clear();
  await db.table('_outbox').clear();
  await documentRepo.create(
    documentSchema.parse({ title: TITLE, category: 'contract', provider: 'Hausverwaltung Ahorn' }),
  );
});
afterEach(() => {
  setNow();
  useUiStore.setState({ paletteOpen: false, paletteWrite: false });
});

describe('documents in the search', () => {
  it('stay searchable: the module declares searchable fields and the full-text search finds a document by title and provider', async () => {
    expect(manifest.aiSchema?.collections.document?.searchable).toEqual(
      expect.arrayContaining(['title', 'provider']),
    );
    for (const q of ['Mietvertrag', 'Ahorn']) {
      // The palette's own call (`useSearchHits`): five hits, all words must match.
      const rows = await searchEntries(q, { manifests: [manifest], database: db }, 5, false);
      expect(
        rows.map((r) => r.title),
        q,
      ).toEqual([TITLE]);
      // Where the hit leads is what switches the reading aid off for its row (`isCredentialPath`).
      expect(rows[0]!.to, q).toMatch(/^\/vault\?open=/);
      expect(isCredentialPath(rows[0]!.to), q).toBe(true);
    }
  });

  it('a document hit in the palette is shown without the reading aid, other rows keep it', async () => {
    expect(isCredentialPath('/vault')).toBe(true);
    expect(isCredentialPath('/vault?new=1')).toBe(true);
    expect(isCredentialPath('/vaults')).toBe(false);

    await enableModule(manifest);
    // The reading aid fully on, through the app's own provider (a module file never imports the aid itself).
    useUiStore.setState({
      paletteOpen: true,
      paletteWrite: false,
      readAid: true,
      readCover: '100',
      readShare: '40',
    });
    const user = userEvent.setup();
    render(
      <ReadAidProvider>
        <MemoryRouter>
          <CommandPalette />
        </MemoryRouter>
      </ReadAidProvider>,
    );
    await user.type(await screen.findByRole('combobox'), 'Mietvertrag');
    const hit = await screen.findByRole('option', { name: new RegExp(TITLE) });
    const marks = (el: Element) => el.querySelectorAll('[data-rs]').length;
    expect(marks(hit)).toBe(0);
    // The aid is on: a row that names no document carries its marks.
    const others = screen.getAllByRole('option').filter((o) => o !== hit);
    expect(others.length).toBeGreaterThan(0);
    expect(others.some((o) => marks(o) > 0)).toBe(true);
  });
});

describe('documents and the quick capture', () => {
  it('no capture type writes to the vault, so free text is never routed there by itself', async () => {
    expect(Object.values(TARGETS).map((target) => target.moduleId)).not.toContain('vault');
    const allOn = Object.fromEntries(allManifests.map((m) => [m.id, true]));
    expect(availableTypes(allOn).map((type) => targetFor(type).moduleId)).not.toContain('vault');

    const opts = { fitness: { meal: true, workout: true }, place: () => true };
    const lines = [
      'Mietvertrag ablegen',
      'Reisepass gültig bis 12.03.2031',
      'Haftpflichtversicherung Police 4711',
      'Garantie Laptop bis 01.10.2028',
      'Unterlagen: Steuerbescheid 2025',
      ...CORPUS.map((c) => c.text),
    ];
    for (const line of lines) {
      const parsed = parseCapture(line, { now: CORPUS_NOW, ...opts });
      const reachable = [parsed.type, ...parsed.alternatives.map((a) => a.type)];
      expect(
        reachable.map((type) => targetFor(type).moduleId),
        line,
      ).not.toContain('vault');
    }
  });

  it('saving a line that names a document leaves the vault untouched', async () => {
    const parsed = parseCapture('Reisepass verlängern', { now: new Date(2026, 8, 29, 10, 0) });
    const saved = await saveCapture(parsed.type, parsed.fields, {
      states: { todos: true, vault: true },
      database: db,
    });
    expect(saved.moduleId).toBe('todos');
    const docs = await documentRepo.table.toArray();
    expect(docs.map((d) => d.title)).toEqual([TITLE]);
  });

  it('a document is added only through the explicit entry of the module (/vault?new=1)', () => {
    expect(manifest.contributions?.quickAdd?.map((a) => ({ id: a.id, to: a.to }))).toEqual([
      { id: 'document', to: '/vault?new=1' },
    ]);
  });
});
