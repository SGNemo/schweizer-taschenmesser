import { describe, expect, it } from 'vitest';
import { moduleOfPath, splitFigure } from './attentionCard';

describe('splitFigure', () => {
  it('takes a leading count as the big figure', () => {
    expect(splitFigure('2 Rechnungen überfällig')).toEqual({
      figure: '2',
      label: 'Rechnungen überfällig',
    });
    expect(splitFigure('1 Vorrat abgelaufen')).toEqual({ figure: '1', label: 'Vorrat abgelaufen' });
  });
  it('keeps titles without a count in one piece', () => {
    expect(splitFigure('Budget „Freizeit“ überschritten')).toEqual({
      label: 'Budget „Freizeit“ überschritten',
    });
    expect(splitFigure('Update verfügbar')).toEqual({ label: 'Update verfügbar' });
  });
  it('does not split user text that merely starts with a number', () => {
    expect(splitFigure('2. Training')).toEqual({ label: '2. Training' });
    expect(splitFigure('10:00 Teammeeting')).toEqual({ label: '10:00 Teammeeting' });
    expect(splitFigure('12345 Dinge')).toEqual({ label: '12345 Dinge' });
  });
});

describe('moduleOfPath', () => {
  it('finds the module by the first path segment, ignoring query and hash', () => {
    expect(moduleOfPath('/invoices')?.id).toBe('invoices');
    expect(moduleOfPath('/todos?view=board')?.id).toBe('todos');
    expect(moduleOfPath('/pantry#expired')?.id).toBe('pantry');
  });
  it('has no module for core routes', () => {
    expect(moduleOfPath('/settings#updates')).toBeUndefined();
    expect(moduleOfPath('')).toBeUndefined();
  });
});
