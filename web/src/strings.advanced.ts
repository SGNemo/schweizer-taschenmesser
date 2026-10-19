import { defineBundle } from '@/core/i18n/bundle';

/** Texts of the Basis/Erweitert view ("Erweitert" switch, "Mehr Felder", settings row), every UI language. */
export const tAdvanced = defineBundle(
  {
    switchLabel: 'Erweitert',
    switchHint: 'Zeigt Spezialfelder und seltene Funktionen in diesem Modul.',
    moreFields: 'Mehr Felder',
    moreFieldsAria: 'Mehr Felder anzeigen',
    settings: {
      title: 'Basis oder Erweitert',
      description:
        'Standard ist Basis: Module zeigen, was du täglich brauchst. Erweitert blendet Spezialfelder und seltene Funktionen ein.',
      keywords: ['erweitert', 'basis', 'einfach', 'spezialfelder', 'mehr felder'],
      all: 'Alle Module in der Erweitert-Ansicht',
      allHint:
        'Der Schalter „Erweitert“ im Kopf eines Moduls gilt dann nur für dieses Modul und überschreibt diese Einstellung.',
    },
  },
  {
    en: {
      switchLabel: 'Advanced',
      switchHint: 'Shows special fields and rarely used functions in this module.',
      moreFields: 'More fields',
      moreFieldsAria: 'Show more fields',
      settings: {
        title: 'Basic or advanced',
        description:
          'Basic is the default: modules show what you need every day. Advanced adds special fields and rarely used functions.',
        keywords: ['advanced', 'basic', 'simple', 'special fields', 'more fields'],
        all: 'All modules in the advanced view',
        allHint:
          'The "Advanced" switch in a module header then applies to that module only and overrides this setting.',
      },
    },
    es: {
      switchLabel: 'Avanzado',
      switchHint: 'Muestra campos especiales y funciones poco usadas en este módulo.',
      moreFields: 'Más campos',
      moreFieldsAria: 'Mostrar más campos',
      settings: {
        title: 'Básico o avanzado',
        description:
          'Lo predeterminado es básico: los módulos muestran lo que necesitas a diario. Avanzado añade campos especiales y funciones poco usadas.',
        keywords: ['avanzado', 'básico', 'simple', 'campos especiales', 'más campos'],
        all: 'Todos los módulos en la vista avanzada',
        allHint:
          'El interruptor «Avanzado» en la cabecera de un módulo vale entonces solo para ese módulo y anula este ajuste.',
      },
    },
    fr: {
      switchLabel: 'Avancé',
      switchHint: 'Affiche les champs spéciaux et les fonctions rarement utilisées dans ce module.',
      moreFields: 'Plus de champs',
      moreFieldsAria: 'Afficher plus de champs',
      settings: {
        title: 'Basique ou avancé',
        description:
          'Basique par défaut : les modules montrent ce dont vous avez besoin chaque jour. Avancé ajoute les champs spéciaux et les fonctions rarement utilisées.',
        keywords: ['avancé', 'basique', 'simple', 'champs spéciaux', 'plus de champs'],
        all: 'Tous les modules en vue avancée',
        allHint:
          "L'interrupteur « Avancé » dans l'en-tête d'un module ne vaut alors que pour ce module et remplace ce réglage.",
      },
    },
    'pt-BR': {
      switchLabel: 'Avançado',
      switchHint: 'Mostra campos especiais e funções pouco usadas neste módulo.',
      moreFields: 'Mais campos',
      moreFieldsAria: 'Mostrar mais campos',
      settings: {
        title: 'Básico ou avançado',
        description:
          'O padrão é básico: os módulos mostram o que você precisa todo dia. Avançado inclui campos especiais e funções pouco usadas.',
        keywords: ['avançado', 'básico', 'simples', 'campos especiais', 'mais campos'],
        all: 'Todos os módulos na visão avançada',
        allHint:
          'O botão "Avançado" no cabeçalho de um módulo vale então só para esse módulo e substitui esta configuração.',
      },
    },
  },
);
