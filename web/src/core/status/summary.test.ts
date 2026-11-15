import { describe, expect, it } from 'vitest';
import type { StatusLine } from './lines';
import {
  calmPoint,
  DEVICE_STATUS_PATH,
  deviceStatusLine,
  needingLook,
  summaryText,
  withTitle,
} from './summary';

const line = (id: string, attention: boolean): StatusLine => ({
  id,
  to: `/settings/${id}`,
  icon: 'sync',
  title: id === 'sync' ? 'Sync' : 'Backup',
  status: id === 'sync' ? 'Fehler beim Abgleich' : 'Letztes Backup fehlgeschlagen',
  context: '',
  attention,
  testId: `overview-${id}`,
});

describe('summary of the device lines', () => {
  it('is calm while nothing needs a look', () => {
    const lines = [line('sync', false), line('backup', false)];
    expect(needingLook(lines)).toEqual([]);
    expect(summaryText(lines)).toBe('Nichts Dringendes');
  });
  it('names the one line in its own words, and counts from two on', () => {
    expect(summaryText([line('sync', true), line('backup', false)])).toBe(
      'Sync: Fehler beim Abgleich',
    );
    expect(summaryText([line('sync', true), line('backup', true)])).toBe(
      '2 Punkte brauchen einen Blick',
    );
  });
  it('the line of the settings leads to the page and carries the mark only when something needs a look', () => {
    const calm = deviceStatusLine([line('sync', false)]);
    expect(calm).toMatchObject({
      to: DEVICE_STATUS_PATH,
      title: 'Gerätestatus',
      status: 'Nichts Dringendes',
      attention: false,
      testId: 'overview-device',
    });
    expect(DEVICE_STATUS_PATH).toBe('/device');
    expect(deviceStatusLine([line('sync', true)]).attention).toBe(true);
  });

  it('names a line only once: "Update verfügbar" under "Updates", "Letztes Backup fehlgeschlagen" under "Backup"', () => {
    expect(withTitle({ title: 'Updates', status: 'Update verfügbar' })).toBe('Update verfügbar');
    expect(withTitle({ title: 'Updates', status: 'Update available' })).toBe('Update available');
    expect(withTitle({ title: 'Backup', status: 'Letztes Backup fehlgeschlagen' })).toBe(
      'Letztes Backup fehlgeschlagen',
    );
    expect(withTitle({ title: 'Sync', status: 'Fehler beim Abgleich' })).toBe(
      'Sync: Fehler beim Abgleich',
    );
  });
  it('names a missing backup calmly, never as a point (0b-8)', () => {
    const missing = { ...line('backup', false), missing: true };
    expect(summaryText([line('sync', false), missing])).toBe('Noch kein Backup');
    expect(calmPoint([missing])).toBe(missing);
    expect(deviceStatusLine([missing]).attention).toBe(false);
  });
  it('waits for the backup read before it names a missing backup', () => {
    const reading = { ...line('backup', false), missing: true, loading: true };
    expect(summaryText([reading])).toBe('Nichts Dringendes');
  });
  it('a line that needs a look wins over the missing backup', () => {
    const missing = { ...line('backup', false), missing: true };
    expect(summaryText([line('sync', true), missing])).toBe('Sync: Fehler beim Abgleich');
    expect(calmPoint([line('sync', true), missing])).toBeUndefined();
  });
  it('only the backup line can be the calm point', () => {
    const other = { ...line('sync', false), missing: true };
    expect(calmPoint([other])).toBeUndefined();
    expect(summaryText([other])).toBe('Nichts Dringendes');
  });
});
