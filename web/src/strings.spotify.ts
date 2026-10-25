import { defineBundle } from '@/core/i18n/bundle';

/** Texts of the Spotify connector and the "Läuft gerade" line, every UI language. */
export const tSpotify = defineBundle(
  {
    name: 'Spotify',
    description:
      'Zeigt auf der Übersicht, was gerade läuft, und steuert Pause, Weiter und Nächster. Nemo spielt selbst nichts ab und speichert keine Titel.',
    showFeature: 'Anzeigen',
    showHint: 'Titel und Interpret lesen, die gerade laufen.',
    controlFeature: 'Steuern',
    controlHint: 'Pause, Weiter und Nächster (braucht Spotify Premium).',
    clientTitle: 'Deine eigene Spotify-App',
    clientIntro:
      'Zum Anmelden brauchst du eine eigene „Client ID“ aus dem Spotify Developer Dashboard. Trage dort als Redirect-URI http://127.0.0.1:38417/callback ein. Die Schritte stehen in docs/user/spotify.de.md.',
    privacy:
      'Titel und Interpret gehen nur von Spotify an dieses Gerät. Sie werden nicht synchronisiert, nicht an die KI und nicht in Fehlerberichte gegeben.',
    playing: 'Läuft gerade',
    paused: 'Pausiert',
    lead: (state: string) => `${state}: `,
    pause: 'Pause',
    resume: 'Weiter',
    next: 'Nächster',
    controlsLabel: 'Wiedergabe steuern',
    premiumHint: 'Steuern braucht Spotify Premium.',
  },
  {
    en: {
      name: 'Spotify',
      description:
        'Shows what is playing on the Overview and controls pause, resume and next. Nemo plays nothing itself and stores no track titles.',
      showFeature: 'Show',
      showHint: 'Read the title and artist that are playing.',
      controlFeature: 'Control',
      controlHint: 'Pause, resume and next (needs Spotify Premium).',
      clientTitle: 'Your own Spotify app',
      clientIntro:
        'To sign in you need your own “Client ID” from the Spotify Developer Dashboard. Add http://127.0.0.1:38417/callback there as the redirect URI. The steps are in docs/user/spotify.md.',
      privacy:
        'Title and artist only travel from Spotify to this device. They are not synced, not sent to the AI and not included in error reports.',
      playing: 'Now playing',
      paused: 'Paused',
      lead: (state: string) => `${state}: `,
      pause: 'Pause',
      resume: 'Resume',
      next: 'Next',
      controlsLabel: 'Playback controls',
      premiumHint: 'Controlling needs Spotify Premium.',
    },
    es: {
      name: 'Spotify',
      description:
        'Muestra en el Resumen lo que suena y controla pausa, continuar y siguiente. Nemo no reproduce nada por sí mismo y no guarda títulos.',
      showFeature: 'Mostrar',
      showHint: 'Leer el título y el artista que suenan.',
      controlFeature: 'Controlar',
      controlHint: 'Pausa, continuar y siguiente (requiere Spotify Premium).',
      clientTitle: 'Tu propia app de Spotify',
      clientIntro:
        'Para iniciar sesión necesitas tu propio «Client ID» del Spotify Developer Dashboard. Añade allí http://127.0.0.1:38417/callback como URI de redirección. Los pasos están en docs/user/spotify.md.',
      privacy:
        'El título y el artista solo viajan de Spotify a este dispositivo. No se sincronizan, no se envían a la IA ni se incluyen en informes de errores.',
      playing: 'Sonando ahora',
      paused: 'En pausa',
      lead: (state: string) => `${state}: `,
      pause: 'Pausa',
      resume: 'Continuar',
      next: 'Siguiente',
      controlsLabel: 'Controlar la reproducción',
      premiumHint: 'Controlar requiere Spotify Premium.',
    },
    fr: {
      name: 'Spotify',
      description:
        'Affiche sur l’Aperçu ce qui est en cours de lecture et commande pause, reprise et suivant. Nemo ne lit rien lui-même et ne garde aucun titre.',
      showFeature: 'Afficher',
      showHint: 'Lire le titre et l’artiste en cours de lecture.',
      controlFeature: 'Commander',
      controlHint: 'Pause, reprise et suivant (nécessite Spotify Premium).',
      clientTitle: 'Votre propre application Spotify',
      clientIntro:
        'Pour vous connecter, il faut votre propre « Client ID » du Spotify Developer Dashboard. Ajoutez-y http://127.0.0.1:38417/callback comme URI de redirection. Les étapes sont dans docs/user/spotify.md.',
      privacy:
        'Le titre et l’artiste vont uniquement de Spotify à cet appareil. Ils ne sont pas synchronisés, pas envoyés à l’IA et absents des rapports d’erreur.',
      playing: 'En cours de lecture',
      paused: 'En pause',
      lead: (state: string) => `${state} : `,
      pause: 'Pause',
      resume: 'Reprendre',
      next: 'Suivant',
      controlsLabel: 'Commandes de lecture',
      premiumHint: 'La commande nécessite Spotify Premium.',
    },
    'pt-BR': {
      name: 'Spotify',
      description:
        'Mostra na Visão geral o que está tocando e controla pausa, continuar e próxima. O Nemo não toca nada por conta própria e não guarda títulos.',
      showFeature: 'Mostrar',
      showHint: 'Ler o título e o artista que estão tocando.',
      controlFeature: 'Controlar',
      controlHint: 'Pausa, continuar e próxima (exige Spotify Premium).',
      clientTitle: 'Seu próprio app do Spotify',
      clientIntro:
        'Para entrar você precisa do seu próprio «Client ID» do Spotify Developer Dashboard. Adicione lá http://127.0.0.1:38417/callback como URI de redirecionamento. Os passos estão em docs/user/spotify.md.',
      privacy:
        'Título e artista só vão do Spotify para este dispositivo. Não são sincronizados, não vão para a IA e não entram em relatórios de erro.',
      playing: 'Tocando agora',
      paused: 'Em pausa',
      lead: (state: string) => `${state}: `,
      pause: 'Pausa',
      resume: 'Continuar',
      next: 'Próxima',
      controlsLabel: 'Controles de reprodução',
      premiumHint: 'Controlar exige Spotify Premium.',
    },
  },
);
