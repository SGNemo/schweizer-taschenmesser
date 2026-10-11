import { defineBundle } from '@/core/i18n/bundle';

/**
 * Texts of the settings comfort features (quick switches, frequently used, context gear, reset,
 * extra search words) in every UI language. Kept next to the feature instead of in `strings.ts`.
 */
export const tComfort = defineBundle(
  {
    quick: {
      title: 'Schnell umschalten',
      changed: (name: string, value: string) => `${name}: ${value}`,
      on: 'An',
      off: 'Aus',
      readAid: 'Lesehilfe',
      keywords: {
        theme: ['dunkel', 'hell', 'Nachtmodus', 'Dunkelmodus'],
        density: ['kompakt', 'enger', 'Abstand'],
        readAid: ['Lesen', 'Bionic', 'Fokus beim Lesen'],
        color: ['ruhig', 'bunt', 'Farben'],
        homeView: ['Startseite', 'Widgets', 'Ruhe'],
      },
    },
    frequent: {
      title: 'Häufig genutzt',
      switchLabel: 'Häufig genutzte Einstellungen merken',
      switchHint:
        'Nemo merkt sich auf diesem Gerät, welche Einstellungen du öffnest, und zeigt die letzten oben an. Nichts wird übertragen. „Verlauf löschen“ leert die Liste.',
    },
    gear: {
      module: (name: string) => `Einstellungen: ${name}`,
      generic: 'Einstellungen dazu',
    },
    reset: {
      button: 'Auf Standard zurücksetzen',
      done: (title: string) => `„${title}“ zurückgesetzt`,
    },
    library: {
      enable: (name: string) => `${name} in der Bibliothek einschalten`,
    },
    synonyms: {
      'appearance--theme': ['dunkel', 'hell', 'Nachtmodus', 'Dark Mode'],
      'appearance--density': ['kompakt', 'enger', 'Abstand', 'Platz'],
      'appearance--textSize': ['Schrift größer', 'Schriftgröße', 'Zoom', 'besser lesen'],
      reading: ['Lesehilfe', 'Bionic', 'Lesen leichter'],
      'calm-reminders': ['leise', 'stumm', 'nicht stören', 'Ruhe', 'Pieps', 'Töne'],
      notifications: ['stumm', 'Töne', 'Mitteilungen', 'Pieps'],
      backup: ['Sicherung', 'Kopie', 'Daten sichern', 'Wiederherstellen'],
      updates: ['Aktualisierung', 'neue Version', 'Update prüfen'],
      sync: ['Abgleich', 'Cloud', 'Geräte verbinden'],
      ai: ['ChatGPT', 'Claude', 'OpenAI', 'Modell wechseln', 'Kosten', 'Limit'],
      quickcapture: ['Kurzbefehl', 'Tastenkombination', 'Shortcut', 'Hotkey'],
      setup: ['Einrichtung', 'Assistent', 'Start', 'erneut'],
      supporter: ['Unterstützer', 'Spende', 'Code'],
      diagnostics: ['Fehler', 'Problem', 'Protokoll', 'Log'],
    } as Record<string, string[]>,
  },
  {
    en: {
      quick: {
        title: 'Quick switches',
        changed: (name: string, value: string) => `${name}: ${value}`,
        on: 'On',
        off: 'Off',
        readAid: 'Reading aid',
        keywords: {
          theme: ['dark', 'light', 'night mode', 'dark mode'],
          density: ['compact', 'tighter', 'spacing'],
          readAid: ['reading', 'bionic', 'focus while reading'],
          color: ['calm', 'colourful', 'colors'],
          homeView: ['home', 'widgets', 'calm'],
        },
      },
      frequent: {
        title: 'Frequently used',
        switchLabel: 'Remember frequently used settings',
        switchHint:
          'Nemo remembers on this device which settings you open and shows the latest ones at the top. Nothing is transferred. “Clear history” empties the list.',
      },
      gear: {
        module: (name: string) => `Settings: ${name}`,
        generic: 'Related settings',
      },
      reset: {
        button: 'Reset to default',
        done: (title: string) => `“${title}” reset`,
      },
      library: {
        enable: (name: string) => `Turn on ${name} in the library`,
      },
      synonyms: {
        'appearance--theme': ['dark', 'light', 'night mode', 'dark mode'],
        'appearance--density': ['compact', 'tighter', 'spacing', 'room'],
        'appearance--textSize': ['bigger text', 'font size', 'zoom', 'easier to read'],
        reading: ['reading aid', 'bionic', 'easier reading'],
        'calm-reminders': ['quiet', 'mute', 'do not disturb', 'silence', 'beep', 'sounds'],
        notifications: ['mute', 'sounds', 'alerts', 'beep'],
        backup: ['save data', 'copy', 'restore', 'export'],
        updates: ['upgrade', 'new version', 'check for updates'],
        sync: ['cloud', 'connect devices', 'server'],
        ai: ['ChatGPT', 'Claude', 'OpenAI', 'switch model', 'cost', 'limit'],
        quickcapture: ['shortcut', 'key combination', 'hotkey'],
        setup: ['setup', 'wizard', 'start again'],
        supporter: ['supporter', 'donation', 'code'],
        diagnostics: ['error', 'problem', 'log'],
      },
    },
    es: {
      quick: {
        title: 'Cambios rápidos',
        changed: (name: string, value: string) => `${name}: ${value}`,
        on: 'Activado',
        off: 'Desactivado',
        readAid: 'Ayuda de lectura',
        keywords: {
          theme: ['oscuro', 'claro', 'modo noche', 'modo oscuro'],
          density: ['compacto', 'más junto', 'espaciado'],
          readAid: ['lectura', 'bionic', 'leer mejor'],
          color: ['tranquilo', 'colorido', 'colores'],
          homeView: ['inicio', 'widgets', 'calma'],
        },
      },
      frequent: {
        title: 'Más usados',
        switchLabel: 'Recordar los ajustes más usados',
        switchHint:
          'Nemo recuerda en este dispositivo qué ajustes abres y muestra los últimos arriba. No se transfiere nada. «Borrar historial» vacía la lista.',
      },
      gear: {
        module: (name: string) => `Ajustes: ${name}`,
        generic: 'Ajustes relacionados',
      },
      reset: {
        button: 'Restablecer valores',
        done: (title: string) => `«${title}» restablecido`,
      },
      library: {
        enable: (name: string) => `Activar ${name} en la biblioteca`,
      },
      synonyms: {
        'appearance--theme': ['oscuro', 'claro', 'modo noche', 'modo oscuro'],
        'appearance--density': ['compacto', 'más junto', 'espaciado', 'espacio'],
        'appearance--textSize': ['letra más grande', 'tamaño de letra', 'zoom', 'leer mejor'],
        reading: ['ayuda de lectura', 'bionic', 'leer más fácil'],
        'calm-reminders': ['silencio', 'silenciar', 'no molestar', 'tranquilo', 'pitido', 'sonidos'],
        notifications: ['silenciar', 'sonidos', 'avisos', 'pitido'],
        backup: ['copia de seguridad', 'copia', 'restaurar', 'exportar'],
        updates: ['actualización', 'nueva versión', 'buscar actualizaciones'],
        sync: ['sincronizar', 'nube', 'conectar dispositivos'],
        ai: ['ChatGPT', 'Claude', 'OpenAI', 'cambiar modelo', 'coste', 'límite'],
        quickcapture: ['atajo', 'combinación de teclas', 'tecla rápida'],
        setup: ['configuración inicial', 'asistente', 'empezar de nuevo'],
        supporter: ['colaborador', 'donación', 'código'],
        diagnostics: ['error', 'problema', 'registro'],
      },
    },
    fr: {
      quick: {
        title: 'Réglages rapides',
        changed: (name: string, value: string) => `${name} : ${value}`,
        on: 'Activé',
        off: 'Désactivé',
        readAid: 'Aide à la lecture',
        keywords: {
          theme: ['sombre', 'clair', 'mode nuit', 'mode sombre'],
          density: ['compact', 'plus serré', 'espacement'],
          readAid: ['lecture', 'bionic', 'mieux lire'],
          color: ['calme', 'coloré', 'couleurs'],
          homeView: ['accueil', 'widgets', 'calme'],
        },
      },
      frequent: {
        title: 'Souvent utilisés',
        switchLabel: 'Mémoriser les réglages souvent utilisés',
        switchHint:
          'Nemo retient sur cet appareil les réglages que vous ouvrez et affiche les derniers en haut. Rien n’est transmis. « Effacer l’historique » vide la liste.',
      },
      gear: {
        module: (name: string) => `Réglages : ${name}`,
        generic: 'Réglages associés',
      },
      reset: {
        button: 'Rétablir les valeurs par défaut',
        done: (title: string) => `« ${title} » rétabli`,
      },
      library: {
        enable: (name: string) => `Activer ${name} dans la bibliothèque`,
      },
      synonyms: {
        'appearance--theme': ['sombre', 'clair', 'mode nuit', 'mode sombre'],
        'appearance--density': ['compact', 'plus serré', 'espacement', 'place'],
        'appearance--textSize': ['texte plus grand', 'taille de police', 'zoom', 'mieux lire'],
        reading: ['aide à la lecture', 'bionic', 'lire plus facilement'],
        'calm-reminders': ['silence', 'muet', 'ne pas déranger', 'calme', 'bip', 'sons'],
        notifications: ['muet', 'sons', 'alertes', 'bip'],
        backup: ['sauvegarde', 'copie', 'restaurer', 'exporter'],
        updates: ['mise à jour', 'nouvelle version', 'rechercher des mises à jour'],
        sync: ['synchroniser', 'cloud', 'connecter des appareils'],
        ai: ['ChatGPT', 'Claude', 'OpenAI', 'changer de modèle', 'coût', 'limite'],
        quickcapture: ['raccourci', 'combinaison de touches', 'touche rapide'],
        setup: ['configuration initiale', 'assistant', 'recommencer'],
        supporter: ['soutien', 'don', 'code'],
        diagnostics: ['erreur', 'problème', 'journal'],
      },
    },
    'pt-BR': {
      quick: {
        title: 'Ajustes rápidos',
        changed: (name: string, value: string) => `${name}: ${value}`,
        on: 'Ligado',
        off: 'Desligado',
        readAid: 'Auxílio de leitura',
        keywords: {
          theme: ['escuro', 'claro', 'modo noturno', 'modo escuro'],
          density: ['compacto', 'mais junto', 'espaçamento'],
          readAid: ['leitura', 'bionic', 'ler melhor'],
          color: ['calmo', 'colorido', 'cores'],
          homeView: ['início', 'widgets', 'calma'],
        },
      },
      frequent: {
        title: 'Mais usadas',
        switchLabel: 'Lembrar as configurações mais usadas',
        switchHint:
          'O Nemo lembra neste dispositivo quais configurações você abre e mostra as últimas no topo. Nada é transferido. “Limpar histórico” esvazia a lista.',
      },
      gear: {
        module: (name: string) => `Configurações: ${name}`,
        generic: 'Configurações relacionadas',
      },
      reset: {
        button: 'Restaurar o padrão',
        done: (title: string) => `“${title}” restaurado`,
      },
      library: {
        enable: (name: string) => `Ligar ${name} na biblioteca`,
      },
      synonyms: {
        'appearance--theme': ['escuro', 'claro', 'modo noturno', 'modo escuro'],
        'appearance--density': ['compacto', 'mais junto', 'espaçamento', 'espaço'],
        'appearance--textSize': ['letra maior', 'tamanho da fonte', 'zoom', 'ler melhor'],
        reading: ['auxílio de leitura', 'bionic', 'leitura mais fácil'],
        'calm-reminders': ['silêncio', 'silenciar', 'não perturbe', 'calmo', 'bipe', 'sons'],
        notifications: ['silenciar', 'sons', 'avisos', 'bipe'],
        backup: ['cópia de segurança', 'cópia', 'restaurar', 'exportar'],
        updates: ['atualização', 'nova versão', 'verificar atualizações'],
        sync: ['sincronizar', 'nuvem', 'conectar dispositivos'],
        ai: ['ChatGPT', 'Claude', 'OpenAI', 'trocar modelo', 'custo', 'limite'],
        quickcapture: ['atalho', 'combinação de teclas', 'tecla rápida'],
        setup: ['configuração inicial', 'assistente', 'recomeçar'],
        supporter: ['apoiador', 'doação', 'código'],
        diagnostics: ['erro', 'problema', 'registro'],
      },
    },
  },
);
