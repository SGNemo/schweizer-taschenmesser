import { afterEach, describe, expect, it } from 'vitest';
import { setNow } from '@/core/time/now';
import { formatHlc, MAX_HLC_DRIFT_MS } from '@/core/db/hlc';
import { parseBackup, BACKUP_FORMAT } from './backup';

// R5 (launch review 2026-11): a field stamped far in the future wins against every later edit on all
// devices, and a push containing it is refused (sync stalls). A backup or share row with such a
// stamp is skipped and counted, like any other row that fails the envelope checks.
const NOW = Date.UTC(2026, 10, 23, 12, 0, 0);
afterEach(() => setNow());

const file = (stamp: string) =>
  JSON.stringify({
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: '2026-11-23T12:00:00.000Z',
    tables: {
      example_entry: [
        { id: 'ok', deletedAt: null, title: 'a', _f: { title: formatHlc(NOW - 1000, 0, 'dev1') } },
        { id: 'future', deletedAt: null, title: 'b', _f: { title: stamp } },
      ],
    },
  });

describe('far-future stamps in a backup', () => {
  it('skips a row stamped beyond the drift bound and keeps the rest', () => {
    setNow(() => NOW);
    const far = formatHlc(NOW + MAX_HLC_DRIFT_MS + 60_000, 0, 'evil');
    const parsed = parseBackup(file(far));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.tables.example_entry!.map((r) => r.id)).toEqual(['ok']);
    expect(parsed.skippedRows).toBe(1);
  });

  it('keeps a row within the bound (a clock a little ahead)', () => {
    setNow(() => NOW);
    const near = formatHlc(NOW + MAX_HLC_DRIFT_MS - 60_000, 0, 'dev2');
    const parsed = parseBackup(file(near));
    expect(parsed.ok && parsed.backup.tables.example_entry!.length).toBe(2);
  });
});
