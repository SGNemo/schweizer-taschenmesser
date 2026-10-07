import type { Strings } from '@/strings';

export const homeEdit: Strings['homeEdit'] = {
  calmNote: (n: number) =>
    n === 1
      ? 'Ruhige Ansicht: 1 Widget ist ausgeblendet.'
      : `Ruhige Ansicht: ${n} Widgets sind ausgeblendet.`,
  showAll: 'Alle Widgets zeigen',
  customize: 'Anpassen',
  done: 'Fertig',
  hide: 'Ausblenden',
  show: 'Einblenden',
  handle: (title: string) => `${title} verschieben`,
  hidden: 'Ausgeblendet',
  instructions:
    'Zum Verschieben Leertaste drücken, mit den Pfeiltasten bewegen und mit der Leertaste ablegen. Esc bricht ab.',
  picked: (title: string) => `${title} aufgenommen.`,
  moved: (title: string, pos: number) => `${title} auf Position ${pos} verschoben.`,
  dropped: (title: string, pos: number) => `${title} auf Position ${pos} abgelegt.`,
  cancelled: 'Verschieben abgebrochen.',
  widgets: 'Widgets',
  widgetsTitle: 'Widgets der Übersicht',
  widgetsNote:
    'Ausblenden betrifft nur die Übersicht, das Modul bleibt aktiv. Deaktivieren kannst du Module in der Bibliothek.',
  widgetsNone: 'Keine aktiven Module mit Widgets.',
  reset: 'Zurücksetzen',
  resetTitle: 'Übersicht zurücksetzen?',
  resetText:
    'Reihenfolge, Größen und ausgeblendete Widgets gehen auf den Standard zurück. Deine Module und Daten bleiben unverändert.',
  resetConfirm: 'Auf Standard zurücksetzen',
  cancel: 'Abbrechen',
  size: (title: string) => `Größe von ${title}`,
  sizeOptions: { s: 'S', m: 'M', l: 'L' } as Record<string, string>,
};
