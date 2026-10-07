import type { Strings } from '@/strings';

export const notes: Strings['notes'] = {
  meta: {
    name: 'Notizen',
    description:
      'Schnelle Notizen mit Titel und Text, ein fester Zettel immer oben, wichtige Notizen anheften, mit Suche.',
    route: 'Notizen',
    widget: 'Notizen',
    quickAdd: 'Notiz',
  },
  title: 'Notizen',
  add: 'Notiz hinzufügen',
  edit: 'Notiz bearbeiten',
  body: 'Text',
  pin: 'Oben anheften',
  scratch: 'Zettel',
  scratchHint: 'Für Zwischendurch, immer oben.',
  scratchClear: 'Zettel leeren',
  search: 'Notizen durchsuchen',
  empty: 'Noch keine Notizen.',
  emptyFiltered: 'Nichts gefunden.',
  widgetEmpty: 'Noch keine Notizen.',
};
