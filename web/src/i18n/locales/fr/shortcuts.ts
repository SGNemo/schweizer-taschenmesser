import type { Strings } from '@/strings';

export const shortcuts: Strings['shortcuts'] = {
  title: 'Raccourcis clavier',
  hint: 'Les lettres seules ne fonctionnent que si vous n’écrivez pas dans un champ.',
  items: [
    { keys: ['Ctrl', 'K'], text: 'Rechercher ou demander' },
    { keys: ['N'], text: 'Nouvelle saisie' },
    { keys: ['G', 'puis H'], text: 'Vers la vue d’ensemble' },
    {
      keys: ['G', 'puis P / G / A / W / T'],
      text: 'Vers Planifier, Argent, Maison, Savoir, Coffre-fort',
    },
    { keys: ['J', 'K'], text: 'Ligne suivante / précédente (aussi ↓ ↑)' },
    { keys: ['Entrée'], text: 'Ouvrir la ligne' },
    { keys: ['E'], text: 'Modifier la ligne' },
    { keys: ['Espace'], text: 'Cocher la ligne' },
    { keys: ['/'], text: 'Rechercher dans la liste' },
    { keys: ['Ctrl', 'Z'], text: 'Annuler la dernière action' },
    { keys: ['Alt', 'L'], text: 'Activer ou désactiver l’aide à la lecture' },
    { keys: ['Échap'], text: 'Fermer / effacer la sélection' },
    { keys: ['Alt', 'Début'], text: 'Vers la vue d’ensemble' },
    { keys: ['?'], text: 'Cette liste' },
  ],
};
