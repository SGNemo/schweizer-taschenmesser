import type { Strings } from '@/strings';

export const homeEdit: Strings['homeEdit'] = {
  calmNote: (n: number) =>
    n <= 1 ? `Vue calme : ${n} widget est masqué.` : `Vue calme : ${n} widgets sont masqués.`,
  showAll: 'Afficher tous les widgets',
  customize: 'Personnaliser',
  done: 'Terminé',
  hide: 'Masquer',
  show: 'Afficher',
  handle: (title: string) => `Déplacer ${title}`,
  hidden: 'Masqué',
  instructions:
    'Pour déplacer, appuyez sur Espace, bougez avec les flèches et déposez avec Espace. Échap annule.',
  picked: (title: string) => `${title} saisi.`,
  moved: (title: string, pos: number) => `${title} déplacé en position ${pos}.`,
  dropped: (title: string, pos: number) => `${title} déposé en position ${pos}.`,
  cancelled: 'Déplacement annulé.',
  widgets: 'Widgets',
  widgetsTitle: 'Widgets de la vue d’ensemble',
  widgetsNote:
    'Masquer ne concerne que la vue d’ensemble, le module reste actif. Vous pouvez désactiver des modules dans la bibliothèque.',
  widgetsNone: 'Aucun module actif avec widget.',
  reset: 'Réinitialiser',
  resetTitle: 'Réinitialiser la vue d’ensemble ?',
  resetText:
    'L’ordre, les tailles et les widgets masqués reviennent aux valeurs par défaut. Vos modules et données restent inchangés.',
  resetConfirm: 'Rétablir les valeurs par défaut',
  cancel: 'Annuler',
  size: (title: string) => `Taille de ${title}`,
  sizeOptions: { s: 'S', m: 'M', l: 'L' } as Record<string, string>,
};
