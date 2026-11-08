import { t } from '@/strings';

/**
 * The status line under a page (A09, round 5): saving is automatic, so the line says where the page
 * is once saved. The scratch pad is not in the page list, so it only says "Gespeichert".
 */
export function saveStatusText(status: 'saved' | 'saving', scratch: boolean): string {
  if (status === 'saving') return t.notes.saving;
  return scratch ? t.notes.saved : t.notes.savedWhere;
}
