import { describe, expect, it } from 'vitest';
import { allManifests } from '@/core/modules/registry';
import { fieldHelpFor } from '@/strings.settingsHelp';

describe('every module setting says in one sentence what it does', () => {
  const fields = allManifests
    .filter((m) => !m.retired)
    .flatMap((m) => m.settings.fields.map((f) => ({ id: m.id, f })));

  it('has a help text, from the module or from the settings fallback, on every field', () => {
    const missing = fields.filter(({ id, f }) => !f.help && !fieldHelpFor(id, f.key));
    expect(missing.map(({ id, f }) => `${id}.${f.key}`)).toEqual([]);
  });

  it('keeps no fallback for a field that does not exist (stale entries)', async () => {
    const { tFieldHelp } = await import('@/strings.settingsHelp');
    const known = new Set(fields.map(({ id, f }) => `${id}.${f.key}`));
    for (const key of Object.keys(tFieldHelp.de)) expect(known.has(key), key).toBe(true);
  });
});
