import { describe, expect, it } from 'vitest';
import { validateManifest } from '@/core/modules/registry';
import importer from '../importer';
import { groupLinks, normalizeLaunchUrl, PRESETS, urlKey } from '../logic';
import manifest from '../manifest';
import { linkSchema } from '../schema';

describe('launcher module', () => {
  it('has a valid manifest, off by default, without AI schema', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.defaultEnabled).toBe(false);
    expect(manifest.aiSchema).toBeUndefined();
  });

  it('only accepts launchable addresses and normalises them', () => {
    expect(normalizeLaunchUrl('dhl.de')).toBe('https://dhl.de/');
    expect(normalizeLaunchUrl(' https://www.bahn.de/ ')).toBe('https://www.bahn.de/');
    expect(normalizeLaunchUrl('mailto:anna@example.test')).toBe('mailto:anna@example.test');
    expect(normalizeLaunchUrl('tel:+4930123456')).toBe('tel:+4930123456');
    for (const bad of [
      '',
      'javascript:alert(1)',
      'data:text/html,x',
      'file:///etc/passwd',
      'intent://x#Intent;end',
      'http://user:pass@example.test/',
      'localhost',
      'two words.de',
    ])
      expect(normalizeLaunchUrl(bad), bad).toBeUndefined();
  });

  it('validates and normalises links on write', () => {
    expect(linkSchema.parse({ title: ' DHL ', url: 'dhl.de' })).toEqual({
      title: 'DHL',
      url: 'https://dhl.de/',
    });
    expect(linkSchema.safeParse({ title: 'x', url: 'javascript:alert(1)' }).success).toBe(false);
    expect(linkSchema.safeParse({ title: '', url: 'https://a.de' }).success).toBe(false);
  });

  it('groups links, unnamed last, sorted by title', () => {
    const groups = groupLinks([
      { title: 'b', group: 'Reisen' },
      { title: 'z' },
      { title: 'a', group: 'Reisen' },
      { title: 'm', group: 'Pakete' },
    ]);
    expect(groups.map((g) => g.group)).toEqual(['Pakete', 'Reisen', '']);
    expect(groups[1]!.items.map((i) => i.title)).toEqual(['a', 'b']);
  });

  it('presets are valid and unique', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    expect(new Set(PRESETS.map((p) => urlKey(p.url))).size).toBe(PRESETS.length);
    for (const p of PRESETS) expect(linkSchema.safeParse(p).success, p.id).toBe(true);
  });

  it('the importer turns presets and the form into candidates', async () => {
    const ctx = { today: '2026-09-29', options: {}, batchId: 'b' };
    const presets = await importer.parse(
      'presets',
      { kind: 'template', ids: ['dhl', 'bahn'] },
      ctx,
    );
    expect(presets.candidates.map((c) => c.label)).toEqual([
      'DHL Sendungsverfolgung',
      'Deutsche Bahn',
    ]);
    const one = await importer.parse(
      'link',
      { kind: 'form', values: { title: 'Mein Verein', url: 'verein.example', group: 'Sport' } },
      ctx,
    );
    expect(one.candidates[0]!.data).toEqual({
      title: 'Mein Verein',
      url: 'https://verein.example/',
      group: 'Sport',
    });
    const bad = await importer.parse(
      'link',
      { kind: 'form', values: { title: 'x', url: 'javascript:1' } },
      ctx,
    );
    expect(bad.candidates).toEqual([]);
    expect(bad.notes).toHaveLength(1);
  });
});
