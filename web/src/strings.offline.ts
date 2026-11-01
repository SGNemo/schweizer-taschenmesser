import { defineBundle } from '@/core/i18n/bundle';

/**
 * Parts that load on first use (tools, chat, the password strength check) and were never opened online,
 * in every UI language. Calm: no error wording, the way forward is "online once" (core/net/OnlineChunk).
 */
export const tOffline = defineBundle(
  {
    part: 'Dieser Teil lädt beim ersten Öffnen aus dem Netz. Sobald du wieder online bist, geht es hier weiter.',
    strength:
      'Die Stärke-Anzeige lädt beim ersten Mal aus dem Netz. Sobald du online bist, erscheint sie hier.',
  },
  {
    en: {
      part: 'This part loads from the internet the first time you open it. As soon as you are back online, it continues here.',
      strength:
        'The strength check loads from the internet the first time. As soon as you are online, it shows up here.',
    },
    es: {
      part: 'Esta parte se carga de internet la primera vez que la abres. En cuanto vuelvas a estar en línea, sigue aquí.',
      strength:
        'El indicador de seguridad se carga de internet la primera vez. En cuanto estés en línea, aparece aquí.',
    },
    fr: {
      part: 'Cette partie se charge depuis internet la première fois que vous l’ouvrez. Dès que vous êtes de nouveau en ligne, elle s’affiche ici.',
      strength:
        'L’indicateur de robustesse se charge depuis internet la première fois. Dès que vous êtes en ligne, il s’affiche ici.',
    },
    'pt-BR': {
      part: 'Esta parte é carregada da internet na primeira vez que você a abre. Assim que você estiver online de novo, ela continua aqui.',
      strength:
        'O indicador de força é carregado da internet na primeira vez. Assim que você estiver online, ele aparece aqui.',
    },
  },
);
