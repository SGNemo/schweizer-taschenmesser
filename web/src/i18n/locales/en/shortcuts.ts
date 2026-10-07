import type { Strings } from '@/strings';

export const shortcuts: Strings['shortcuts'] = {
  title: 'Tastenkürzel',
  hint: 'Einzelne Buchstaben wirken nur, wenn du nicht in einem Feld schreibst.',
  items: [
    { keys: ['Strg', 'K'], text: 'Suchen oder fragen' },
    { keys: ['N'], text: 'Neu erfassen' },
    { keys: ['G', 'dann H'], text: 'Zur Übersicht' },
    { keys: ['G', 'dann P / G / A / W / T'], text: 'Zu Planen, Geld, Haushalt, Wissen, Tresor' },
    { keys: ['J', 'K'], text: 'Nächste / vorherige Zeile (auch ↓ ↑)' },
    { keys: ['Enter'], text: 'Zeile öffnen' },
    { keys: ['E'], text: 'Zeile bearbeiten' },
    { keys: ['Leertaste'], text: 'Zeile abhaken' },
    { keys: ['/'], text: 'Liste durchsuchen' },
    { keys: ['Strg', 'Z'], text: 'Letzte Aktion rückgängig machen' },
    { keys: ['Alt', 'L'], text: 'Lesehilfe ein- oder ausschalten' },
    { keys: ['Esc'], text: 'Schließen / Auswahl aufheben' },
    { keys: ['Alt', 'Pos1'], text: 'Zur Übersicht' },
    { keys: ['?'], text: 'Diese Übersicht' },
  ],
};
