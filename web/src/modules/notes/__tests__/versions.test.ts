import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import {
  addVersion,
  loadVersions,
  MAX_VERSIONS,
  MIN_GAP_MS,
  recordVersion,
} from '../editor/versions';

const v = (at: number, body = `b${at}`) => ({ at, title: 't', body });

describe('addVersion', () => {
  it('puts the newest first and ignores an unchanged state', () => {
    const one = addVersion([], v(0));
    const two = addVersion(one, v(MIN_GAP_MS + 1));
    expect(two.map((x) => x.at)).toEqual([MIN_GAP_MS + 1, 0]);
    expect(addVersion(two, { ...v(MIN_GAP_MS * 5), body: two[0]!.body })).toEqual(two);
  });
  it('keeps at most one state per two minutes unless forced', () => {
    const list = [v(0)];
    expect(addVersion(list, v(60_000))).toEqual(list);
    expect(addVersion(list, v(60_000), { force: true })).toHaveLength(2);
  });
  it('keeps the latest 20', () => {
    let list: ReturnType<typeof addVersion> = [];
    for (let i = 0; i < 30; i++) list = addVersion(list, v(i * MIN_GAP_MS));
    expect(list).toHaveLength(MAX_VERSIONS);
    expect(list[0]!.at).toBe(29 * MIN_GAP_MS);
  });
});

describe('stored history', () => {
  beforeEach(async () => {
    await db.table('_blobs').clear();
  });
  it('round-trips through the device-local blob store', async () => {
    await recordVersion('p1', v(0));
    await recordVersion('p1', v(MIN_GAP_MS * 2));
    expect((await loadVersions('p1')).map((x) => x.at)).toEqual([MIN_GAP_MS * 2, 0]);
    expect(await loadVersions('other')).toEqual([]);
  });
  it('survives damaged data', async () => {
    await db.table('_blobs').put({
      key: 'notes:ver:bad',
      type: 'text/plain',
      data: new TextEncoder().encode('{').buffer,
    });
    expect(await loadVersions('bad')).toEqual([]);
  });
});
