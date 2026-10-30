import type { Strings } from '@/strings';

export const voice: Strings['voice'] = {
  title: 'Saisie vocale',
  intro:
    'Appuyez sur une touche pour parler à la recherche et à l’IA. Le texte reconnu arrive dans le champ de saisie ; vous l’envoyez vous-même.',
  enable: 'Utiliser la saisie vocale',
  enableHint: 'Désactivée tant que vous ne l’activez pas.',
  unavailable:
    'Indisponible ici : cet appareil ou ce navigateur n’a pas de reconnaissance vocale. La saisie au clavier fonctionne comme d’habitude.',
  key: 'Touche dans l’app',
  keyHint:
    'Maintenez et parlez, ou appuyez une fois puis encore une fois pour terminer. Échap annule.',
  keyRecord: 'Changer la touche',
  keyRecording: 'Appuyez sur une touche …',
  keyOff: 'Aucune touche',
  keyClear: 'Retirer',
  keyDefault: 'Par défaut',
  keyInvalid: 'Utilisez une touche de F1 à F12, ou une touche avec Ctrl ou Alt.',
  globalKey: 'Touche système',
  globalHint:
    'Fonctionne aussi quand Nemo est en arrière-plan : un appui démarre, le suivant termine l’enregistrement.',
  noticeTitle: 'Activer la saisie vocale ?',
  noticeText:
    'Pour reconnaître la voix, votre navigateur ou votre système peut envoyer le son à son fournisseur, par exemple Google ou Microsoft. Nemo ne conserve ni le son ni le texte reconnu, n’écrit rien dans les journaux et ne transmet rien à l’IA tant que vous n’envoyez pas vous-même. La langue suit celle de l’app.',
  noticeConfirm: 'Activer',
  noticeCancel: 'Pas maintenant',
  button: 'Parler',
  buttonStop: 'Terminer l’enregistrement',
  listening: 'J’écoute …',
  listeningHint: (key: string) => `${key} ou un appui termine. Échap annule.`,
  listeningHintNoKey: 'Un appui termine. Échap annule.',
  finishing: 'Un instant …',
  shortcutText: 'Parler (maintenir ou appuyer)',
  notices: {
    denied: 'Le micro n’est pas autorisé. Vous pouvez l’autoriser dans les réglages du navigateur.',
    silent: 'Je n’ai rien entendu. Vous pouvez réessayer.',
    failed:
      'La saisie vocale ne fonctionne pas ici pour le moment. La saisie au clavier fonctionne comme d’habitude.',
  },
  searchWords: [
    'Micro',
    'Dictée',
    'Parler',
    'Appuyer pour parler',
    'Voix',
    'Reconnaissance vocale',
  ],
};
