import { describe, expect, it } from 'vitest';
import { collectHeadlines } from './contributions';
import type { ModuleManifest } from './types';

const manifest = (id: string, over: Partial<ModuleManifest> = {}): ModuleManifest =>
  ({
    id,
    identity: { hue: 'teal', widgetType: 'kpi' },
    contributions: {},
    ...over,
  }) as ModuleManifest;

describe('cockpit headline figures', () => {
  it('collects the figures of modules that offer one, with the module hue; failures and empty answers are skipped', async () => {
    const list = await collectHeadlines('2026-11-02', [
      manifest('finance', {
        contributions: {
          headline: async () => ({
            default: async () => ({ label: 'Kontostand', value: '2.418,60 €', detail: '2 Konten' }),
          }),
        },
      }),
      manifest('notes'),
      manifest('empty', {
        contributions: { headline: async () => ({ default: async () => undefined }) },
      }),
      manifest('broken', {
        contributions: {
          headline: async () => ({
            default: async () => {
              throw new Error('nope');
            },
          }),
        },
      }),
    ]);
    expect(list).toEqual([
      {
        moduleId: 'finance',
        hue: 'teal',
        label: 'Kontostand',
        value: '2.418,60 €',
        detail: '2 Konten',
      },
    ]);
  });
});
