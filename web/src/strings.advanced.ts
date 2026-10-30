import { defineBundle } from '@/core/i18n/bundle';

/** Texts of the Basis/Erweitert view ("Erweitert" switch, "Mehr Felder", settings row), every UI language. */
export const tAdvanced = defineBundle(
  {
    switchLabel: 'Mehr Felder anzeigen',
    switchHint:
      'Blendet in diesem Modul zusätzliche Felder und seltene Funktionen ein, zum Beispiel Kategorien, Notizen oder Wiederholungen.',
    moreFields: 'Mehr Felder',
    moreFieldsAria: 'Mehr Felder anzeigen',
    settings: {
      title: 'Mehr Felder anzeigen',
      description:
        'Standard: Module zeigen, was du täglich brauchst. Hier schaltest du für alle Module zusätzliche Felder und seltene Funktionen dazu.',
      keywords: ['erweitert', 'basis', 'einfach', 'spezialfelder', 'mehr felder'],
      all: 'In allen Modulen mehr Felder anzeigen',
      allHint:
        'Der Schalter „Mehr Felder anzeigen“ im Kopf eines Moduls gilt dann nur für dieses Modul und überschreibt diese Einstellung.',
    },
  },
  {
    en: {
      switchLabel: 'Show more fields',
      switchHint:
        'Adds extra fields and rarely used functions to this module, for example categories, notes or repeats.',
      moreFields: 'More fields',
      moreFieldsAria: 'Show more fields',
      settings: {
        title: 'Show more fields',
        description:
          'By default modules show what you need every day. Here you add extra fields and rarely used functions to all modules.',
        keywords: ['advanced', 'basic', 'simple', 'special fields', 'more fields'],
        all: 'Show more fields in all modules',
        allHint:
          'The "Show more fields" switch in a module header then applies to that module only and overrides this setting.',
      },
    },
    es: {
      switchLabel: 'Mostrar más campos',
      switchHint:
        'Añade a este módulo campos extra y funciones poco usadas, por ejemplo categorías, notas o repeticiones.',
      moreFields: 'Más campos',
      moreFieldsAria: 'Mostrar más campos',
      settings: {
        title: 'Mostrar más campos',
        description:
          'Por defecto los módulos muestran lo que necesitas a diario. Aquí añades campos extra y funciones poco usadas a todos los módulos.',
        keywords: ['avanzado', 'básico', 'simple', 'campos especiales', 'más campos'],
        all: 'Mostrar más campos en todos los módulos',
        allHint:
          'El interruptor «Mostrar más campos» en la cabecera de un módulo vale entonces solo para ese módulo y anula este ajuste.',
      },
    },
    fr: {
      switchLabel: 'Afficher plus de champs',
      switchHint:
        'Ajoute à ce module des champs supplémentaires et des fonctions rarement utilisées, par exemple catégories, notes ou répétitions.',
      moreFields: 'Plus de champs',
      moreFieldsAria: 'Afficher plus de champs',
      settings: {
        title: 'Afficher plus de champs',
        description:
          'Par défaut, les modules montrent ce dont vous avez besoin chaque jour. Ici, vous ajoutez des champs supplémentaires et des fonctions rarement utilisées à tous les modules.',
        keywords: ['avancé', 'basique', 'simple', 'champs spéciaux', 'plus de champs'],
        all: 'Afficher plus de champs dans tous les modules',
        allHint:
          "L'interrupteur « Afficher plus de champs » dans l'en-tête d'un module ne vaut alors que pour ce module et remplace ce réglage.",
      },
    },
    'pt-BR': {
      switchLabel: 'Mostrar mais campos',
      switchHint:
        'Inclui neste módulo campos extras e funções pouco usadas, por exemplo categorias, notas ou repetições.',
      moreFields: 'Mais campos',
      moreFieldsAria: 'Mostrar mais campos',
      settings: {
        title: 'Mostrar mais campos',
        description:
          'Por padrão os módulos mostram o que você precisa todo dia. Aqui você inclui campos extras e funções pouco usadas em todos os módulos.',
        keywords: ['avançado', 'básico', 'simples', 'campos especiais', 'mais campos'],
        all: 'Mostrar mais campos em todos os módulos',
        allHint:
          'O botão "Mostrar mais campos" no cabeçalho de um módulo vale então só para esse módulo e substitui esta configuração.',
      },
    },
  },
);
