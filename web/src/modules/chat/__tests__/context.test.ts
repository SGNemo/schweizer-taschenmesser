import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { clearAll, CORE_IDS, seed, TODAY, useFixedClock } from '@/core/ai/testing';
import { buildSchemaText } from '@/core/ai/prompt';
import { visibleManifests } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import manifest from '../manifest';
import { buildContext, contextModules, MAX_CONTEXT_CHARS } from '../context';

const manifests = visibleManifests.filter((m) => CORE_IDS.includes(m.id));
const deps = { manifests, known: visibleManifests, today: TODAY };

beforeEach(async () => {
  useFixedClock();
  await clearAll();
  await seed();
});
afterAll(() => setNow());

describe('chat context', () => {
  it('is empty without allowed modules and never offers the chat itself or the vault', () => {
    const offered = contextModules(visibleManifests).map((m) => m.id);
    expect(offered).not.toContain('accounts');
    expect(offered).not.toContain('chat');
    expect(offered).not.toContain('disk');
  });

  it('answers locally from the allowed modules only', async () => {
    expect(await buildContext('Was steht heute an?', [], deps)).toBeUndefined();
    const text = await buildContext('Was steht heute an?', ['calendar', 'todos'], deps);
    expect(text).toBeTruthy();
    expect(text!.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS + 2);
  });

  it('does not leak other modules when only one is allowed', async () => {
    const text = (await buildContext('Zeig mir alle Rechnungen', ['todos'], deps)) ?? '';
    expect(text.toLowerCase()).not.toContain('stadtwerke');
  });

  it('the chat content is invisible to the assistant: no aiSchema, no data API, blocked by id', async () => {
    expect(manifest.aiSchema).toBeUndefined();
    expect(manifest.dataApi).toBe(false);
    expect(buildSchemaText(visibleManifests)).not.toMatch(/chat_|thread|message/i);
    const { BLOCKED_MODULES } = await import('@/core/dataapi/scope');
    expect(BLOCKED_MODULES).toContain('chat');
  });
});
