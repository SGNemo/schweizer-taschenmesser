import { defineBundle } from '@/core/i18n/bundle';

/**
 * Texts of the game mode ("Zock-Modus", Settings → Notifications) in every UI language. Kept next
 * to the feature instead of in `strings.ts`.
 */
export const tGame = defineBundle(
  {
    title: 'Zock-Modus',
    description:
      'Wenn du spielst, kommt eine Erinnerung leise: ohne Windows-Ton, dafür mit einem kurzen, leichten Ton der App.',
    descriptionQuiet:
      'Erinnerungen kommen ohne Ton oder Vibration, solange der Schalter an ist. Du kannst ihn jederzeit ausschalten.',
    mode: 'Zock-Modus',
    modes: { off: 'Aus', auto: 'Automatisch', on: 'Immer' },
    modesQuiet: { off: 'Aus', on: 'An' },
    autoHint:
      'Automatisch erkennt Windows selbst, ob ein Vollbild-Spiel oder eine Präsentation läuft. Die App erfährt nie, was läuft. „Immer“ hilft, wenn die Erkennung nichts merkt.',
    sound: 'Ton',
    sounds: { soft: 'Sanft', bell: 'Glocke', drop: 'Tropfen' },
    volume: 'Lautstärke',
    volumeValue: (percent: number) => `${percent} %`,
    test: 'Ton testen',
    muteNote: 'Bei „Stumm“ bleibt auch dieser Ton aus.',
  },
  {
    en: {
      title: 'Gaming mode',
      description:
        'While you play, a reminder arrives quietly: without the Windows sound, with a short, light tone from the app instead.',
      descriptionQuiet:
        'Reminders arrive without sound or vibration while this switch is on. You can turn it off any time.',
      mode: 'Gaming mode',
      modes: { off: 'Off', auto: 'Automatic', on: 'Always' },
      modesQuiet: { off: 'Off', on: 'On' },
      autoHint:
        'Automatic lets Windows itself tell whether a full-screen game or a presentation is running. The app never learns what is running. “Always” helps when the detection notices nothing.',
      sound: 'Tone',
      sounds: { soft: 'Soft', bell: 'Bell', drop: 'Drop' },
      volume: 'Volume',
      volumeValue: (percent: number) => `${percent}%`,
      test: 'Test tone',
      muteNote: 'While “Mute” is on, this tone stays off too.',
    },
    es: {
      title: 'Modo juego',
      description:
        'Mientras juegas, el recordatorio llega en silencio: sin el sonido de Windows, con un tono breve y suave de la app.',
      descriptionQuiet:
        'Los recordatorios llegan sin sonido ni vibración mientras el interruptor esté activado. Puedes desactivarlo cuando quieras.',
      mode: 'Modo juego',
      modes: { off: 'Desactivado', auto: 'Automático', on: 'Siempre' },
      modesQuiet: { off: 'Desactivado', on: 'Activado' },
      autoHint:
        'En automático, Windows mismo indica si hay un juego a pantalla completa o una presentación. La app nunca sabe qué se está ejecutando. «Siempre» ayuda cuando la detección no se entera.',
      sound: 'Tono',
      sounds: { soft: 'Suave', bell: 'Campana', drop: 'Gota' },
      volume: 'Volumen',
      volumeValue: (percent: number) => `${percent} %`,
      test: 'Probar tono',
      muteNote: 'Con «Silencio» activado, este tono tampoco suena.',
    },
    fr: {
      title: 'Mode jeu',
      description:
        'Pendant que vous jouez, le rappel arrive discrètement : sans le son de Windows, avec un court signal léger de l’app.',
      descriptionQuiet:
        'Les rappels arrivent sans son ni vibration tant que l’interrupteur est activé. Vous pouvez le désactiver à tout moment.',
      mode: 'Mode jeu',
      modes: { off: 'Désactivé', auto: 'Automatique', on: 'Toujours' },
      modesQuiet: { off: 'Désactivé', on: 'Activé' },
      autoHint:
        'En mode automatique, Windows indique lui-même si un jeu en plein écran ou une présentation est en cours. L’app ne sait jamais ce qui tourne. « Toujours » aide quand la détection ne remarque rien.',
      sound: 'Son',
      sounds: { soft: 'Doux', bell: 'Cloche', drop: 'Goutte' },
      volume: 'Volume',
      volumeValue: (percent: number) => `${percent} %`,
      test: 'Tester le son',
      muteNote: 'Quand « Muet » est activé, ce son reste coupé aussi.',
    },
    'pt-BR': {
      title: 'Modo jogo',
      description:
        'Enquanto você joga, o lembrete chega em silêncio: sem o som do Windows, com um tom curto e leve do app.',
      descriptionQuiet:
        'Os lembretes chegam sem som nem vibração enquanto a chave estiver ligada. Você pode desligá-la quando quiser.',
      mode: 'Modo jogo',
      modes: { off: 'Desligado', auto: 'Automático', on: 'Sempre' },
      modesQuiet: { off: 'Desligado', on: 'Ligado' },
      autoHint:
        'No automático, o próprio Windows informa se há um jogo em tela cheia ou uma apresentação. O app nunca sabe o que está rodando. “Sempre” ajuda quando a detecção não percebe nada.',
      sound: 'Tom',
      sounds: { soft: 'Suave', bell: 'Sino', drop: 'Gota' },
      volume: 'Volume',
      volumeValue: (percent: number) => `${percent}%`,
      test: 'Testar tom',
      muteNote: 'Com “Silenciar” ligado, este tom também fica desligado.',
    },
  },
);
