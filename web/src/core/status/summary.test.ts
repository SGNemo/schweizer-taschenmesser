import { describe, expect, it } from 'vitest';
import type { StatusLine } from './lines';
import { DEVICE_STATUS_PATH, deviceStatusLine, needingLook, summaryText } from './summary';

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
    expect(summaryText(lines)).toBe('Alles in Ordnung');
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
      status: 'Alles in Ordnung',
      attention: false,
      testId: 'overview-device',
    });
    expect(DEVICE_STATUS_PATH).toBe('/device');
    expect(deviceStatusLine([line('sync', true)]).attention).toBe(true);
  });
});
