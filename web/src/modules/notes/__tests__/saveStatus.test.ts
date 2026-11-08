import { describe, expect, it } from 'vitest';
import { t } from '@/strings';
import { saveStatusText } from '../saveStatus';

describe('A09 (round 5): the save line says where the page is', () => {
  it('names the place for a normal page', () => {
    expect(saveStatusText('saved', false)).toBe(t.notes.savedWhere);
    expect(t.notes.savedWhere).toContain(t.notes.saved);
    expect(t.notes.savedWhere).toContain('Notizen → Alle Seiten');
  });
  it('the scratch pad and the saving state stay short', () => {
    expect(saveStatusText('saved', true)).toBe(t.notes.saved);
    expect(saveStatusText('saving', false)).toBe(t.notes.saving);
  });
});
