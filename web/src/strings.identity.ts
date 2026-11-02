import { defineBundle } from '@/core/i18n/bundle';

/** Texts of the module identity (module colours switch), every UI language. */
export const tIdentity = defineBundle(
  {
    moduleColors: 'Modulfarben',
    moduleColorsHint:
      'Jedes Modul hat eine eigene Farbe an Kästchen, Kante und Symbol. Aus: alles in Grau, die Symbole bleiben.',
    options: { on: 'An', off: 'Aus' },
    keywords: ['modulfarbe', 'modulfarben', 'farbe', 'kante', 'symbol'],
  },
  {
    en: {
      moduleColors: 'Module colours',
      moduleColorsHint:
        'Each module has its own colour on chip, edge and icon. Off: all grey, the icons stay.',
      options: { on: 'On', off: 'Off' },
      keywords: ['module colour', 'module colours', 'colour', 'edge', 'icon'],
    },
    es: {
      moduleColors: 'Colores de módulo',
      moduleColorsHint:
        'Cada módulo tiene su propio color en la ficha, el borde y el icono. Apagado: todo en gris, los iconos se mantienen.',
      options: { on: 'Activado', off: 'Desactivado' },
      keywords: ['color de módulo', 'colores', 'borde', 'icono'],
    },
    fr: {
      moduleColors: 'Couleurs des modules',
      moduleColorsHint:
        'Chaque module a sa propre couleur sur la pastille, le bord et l’icône. Désactivé : tout en gris, les icônes restent.',
      options: { on: 'Activé', off: 'Désactivé' },
      keywords: ['couleur de module', 'couleurs', 'bord', 'icône'],
    },
    'pt-BR': {
      moduleColors: 'Cores dos módulos',
      moduleColorsHint:
        'Cada módulo tem a própria cor no cartão, na borda e no ícone. Desligado: tudo em cinza, os ícones ficam.',
      options: { on: 'Ligado', off: 'Desligado' },
      keywords: ['cor do módulo', 'cores', 'borda', 'ícone'],
    },
  },
);
