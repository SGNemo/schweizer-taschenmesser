import { defineBundle } from '@/core/i18n/bundle';

/** Texts of the module identity (module colours switch), every UI language. */
export const tIdentity = defineBundle(
  {
    moduleColors: 'Modulfarben',
    moduleColorsHint:
      'Jedes Modul hat eine eigene Farbe an Symbol, Kopf und Menüeintrag. Aus: alles in Grau und ohne Muster, die Symbole bleiben.',
    options: { on: 'An', off: 'Aus' },
    keywords: ['modulfarbe', 'modulfarben', 'farbe', 'kopf', 'muster', 'symbol'],
    head: {
      hourStrip: (n: number) =>
        n === 0
          ? 'Heute keine Termine mit Uhrzeit'
          : n === 1
            ? 'Heute 1 Termin'
            : `Heute ${n} Termine`,
      week: (n: string) => `KW ${n}`,
    },
  },
  {
    en: {
      moduleColors: 'Module colours',
      moduleColorsHint:
        'Each module has its own colour on icon, head and menu entry. Off: all grey and no patterns, the icons stay.',
      options: { on: 'On', off: 'Off' },
      keywords: ['module colour', 'module colours', 'colour', 'head', 'pattern', 'icon'],
      head: {
        hourStrip: (n: number) =>
          n === 0
            ? 'No timed appointments today'
            : n === 1
              ? '1 appointment today'
              : `${n} appointments today`,
        week: (n: string) => `Week ${n}`,
      },
    },
    es: {
      moduleColors: 'Colores de módulo',
      moduleColorsHint:
        'Cada módulo tiene su propio color en el icono, la cabecera y la entrada del menú. Apagado: todo en gris y sin patrones, los iconos se mantienen.',
      options: { on: 'Activado', off: 'Desactivado' },
      keywords: ['color de módulo', 'colores', 'cabecera', 'patrón', 'icono'],
      head: {
        hourStrip: (n: number) =>
          n === 0 ? 'Hoy no hay citas con hora' : n === 1 ? '1 cita hoy' : `${n} citas hoy`,
        week: (n: string) => `Sem. ${n}`,
      },
    },
    fr: {
      moduleColors: 'Couleurs des modules',
      moduleColorsHint:
        'Chaque module a sa propre couleur sur l’icône, l’en-tête et l’entrée du menu. Désactivé : tout en gris et sans motifs, les icônes restent.',
      options: { on: 'Activé', off: 'Désactivé' },
      keywords: ['couleur de module', 'couleurs', 'en-tête', 'motif', 'icône'],
      head: {
        hourStrip: (n: number) =>
          n === 0
            ? 'Aucun rendez-vous à heure fixe aujourd’hui'
            : n === 1
              ? '1 rendez-vous aujourd’hui'
              : `${n} rendez-vous aujourd’hui`,
        week: (n: string) => `Sem. ${n}`,
      },
    },
    'pt-BR': {
      moduleColors: 'Cores dos módulos',
      moduleColorsHint:
        'Cada módulo tem a própria cor no ícone, no cabeçalho e no item do menu. Desligado: tudo em cinza e sem padrões, os ícones ficam.',
      options: { on: 'Ligado', off: 'Desligado' },
      keywords: ['cor do módulo', 'cores', 'cabeçalho', 'padrão', 'ícone'],
      head: {
        hourStrip: (n: number) =>
          n === 0
            ? 'Nenhum compromisso com horário hoje'
            : n === 1
              ? '1 compromisso hoje'
              : `${n} compromissos hoje`,
        week: (n: string) => `Sem. ${n}`,
      },
    },
  },
);
