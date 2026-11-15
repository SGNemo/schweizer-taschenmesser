import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { ctxFor } from '@/core/ai/testing';
import { commitOps } from '@/core/ai/write/commit';
import { prepareOp } from '@/core/ai/write/prepare';
import { visibleManifests } from '@/core/modules/registry';
import { aiSchema } from '../ai';
import { MAX_PLACES, addPlace } from '../repo';

const op = { module: 'clock', action: 'create', data: { label: 'Lima' } };

describe('clock.create in the assistant', () => {
  beforeEach(async () => {
    await db.table('clock_place').clear();
  });

  it('declares the page limit', () => {
    expect(aiSchema.actions?.create?.maxActive).toBe(MAX_PLACES);
  });

  it('is ready while there is room', async () => {
    const prepared = await prepareOp(op, 0, ctxFor(['clock']));
    expect(prepared).toMatchObject({ ready: true, data: { zone: 'America/Lima' } });
  });

  it('refuses a 13th place in the preview and writes nothing', async () => {
    for (let i = 0; i < MAX_PLACES; i++) await addPlace(`Ort ${i}`, 'Europe/Berlin');
    const prepared = await prepareOp(op, 0, ctxFor(['clock']));
    expect(prepared).toMatchObject({ error: 'full', ready: false });
    const result = await commitOps([prepared], { manifests: visibleManifests, source: 'test' });
    expect(result.written).toBe(0);
    expect(await db.table('clock_place').count()).toBe(MAX_PLACES);
  });
});
