import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { ackNotification, isAcked } from './ack';
import { snoozeNotification } from './snooze';

beforeEach(async () => {
  await db.table('_settings').clear();
  await db.table('_meta').clear();
});

describe('answers (Erledigt / Später)', () => {
  it('are synced: they live in the settings scope, not only on this device', async () => {
    await ackNotification('event:a:2026-10-02T10:00');
    expect(await db.table('_meta').get('reminders.acked')).toBeUndefined();
    const row = await db.table('_settings').get('reminders');
    expect(row['ack:event:a:2026-10-02T10:00']).toEqual(expect.any(Number));
    expect(await isAcked('event:a:2026-10-02T10:00')).toBe(true);
    expect(await isAcked('event:b:2026-10-02T10:00')).toBe(false);
  });

  it('an answer that arrives from another device ends the series here too', async () => {
    const row = await db.table('_settings').get('reminders');
    expect(row).toBeUndefined();
    // What the sync engine writes for a remote change of the same scope.
    await db.table('_settings').put({
      id: 'reminders',
      createdAt: '2026-10-02T10:00:00.000Z',
      updatedAt: '2026-10-02T11:10:00.000Z',
      deviceId: 'phone',
      deletedAt: null,
      _f: {},
      'ack:event:a:2026-10-02T10:00': 1,
    });
    expect(await isAcked('event:a:2026-10-02T10:00')).toBe(true);
  });

  it('older device-local answers still count', async () => {
    await db.table('_meta').put({ key: 'reminders.acked', value: ['old'] });
    expect(await isAcked('old')).toBe(true);
  });

  it('do not disturb the "Später" entries in the same scope, in both orders', async () => {
    await ackNotification('k1');
    await snoozeNotification({ key: 'k2', title: 'Paket' }, '1h', 1_000_000);
    await ackNotification('k3');
    const row = await db.table('_settings').get('reminders');
    expect(Object.keys(row).filter((f) => f.startsWith('ack:'))).toEqual(['ack:k1', 'ack:k3']);
    expect(row.snoozed).toHaveLength(1);
  });

  it('two devices answering different reminders offline lose nothing (one field per answer)', async () => {
    // Device B wrote its field with a newer clock; device A's field arrives next to it.
    await ackNotification('from-a');
    const row = await db.table('_settings').get('reminders');
    await db
      .table('_settings')
      .put({ ...row, 'ack:from-b': 1, _f: { ...row._f, 'ack:from-b': 'x' } });
    expect(await isAcked('from-a')).toBe(true);
    expect(await isAcked('from-b')).toBe(true);
  });

  it('drops answers older than three days on write', async () => {
    await db.table('_settings').put({
      id: 'reminders',
      createdAt: 'x',
      updatedAt: 'x',
      deviceId: 'd',
      deletedAt: null,
      _f: {},
      'ack:old': 1,
    });
    await ackNotification('new');
    expect(await isAcked('old')).toBe(false);
    expect(await isAcked('new')).toBe(true);
  });
});
