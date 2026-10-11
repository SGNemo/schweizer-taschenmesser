import type { Strings } from '@/strings';

export const notes: Strings['notes'] = {
  meta: {
    name: 'Notes',
    description:
      'Notes rapides avec titre et texte, un bloc-notes fixe toujours en haut, épinglez les notes importantes, avec recherche.',
    route: 'Notes',
    widget: 'Notes',
    quickAdd: 'Note',
  },
  title: 'Notes',
  add: 'Ajouter une note',
  edit: 'Modifier la note',
  body: 'Texte',
  pin: 'Épingler en haut',
  scratch: 'Bloc-notes',
  scratchHint: 'Pour noter en passant, toujours en haut.',
  scratchClear: 'Vider le bloc-notes',
  search: 'Rechercher des notes',
  empty: 'Aucune note pour l’instant.',
  emptyFiltered: 'Aucun résultat.',
  widgetEmpty: 'Aucune note pour l’instant.',
};
