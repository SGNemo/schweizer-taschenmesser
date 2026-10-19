import type { Strings } from '@/strings';

export const voice: Strings['voice'] = {
  title: 'Entrada de voz',
  intro:
    'Pulsa una tecla para hablar con la búsqueda y la IA. El texto reconocido aparece en el campo de entrada; tú lo envías.',
  enable: 'Usar entrada de voz',
  enableHint: 'Desactivada hasta que la actives.',
  unavailable:
    'No disponible aquí: este dispositivo o navegador no tiene reconocimiento de voz. Escribir funciona como siempre.',
  key: 'Tecla en la app',
  keyHint: 'Mantén pulsada y habla, o toca una vez y vuelve a tocar para terminar. Esc cancela.',
  keyRecord: 'Cambiar tecla',
  keyRecording: 'Pulsa una tecla …',
  keyOff: 'Sin tecla',
  keyClear: 'Quitar',
  keyDefault: 'Predeterminada',
  keyInvalid: 'Usa una tecla de F1 a F12, o una tecla junto con Ctrl o Alt.',
  globalKey: 'Tecla global',
  globalHint:
    'También funciona con Nemo en segundo plano: una pulsación inicia y la siguiente termina la grabación.',
  noticeTitle: '¿Activar la entrada de voz?',
  noticeText:
    'Para reconocer la voz, tu navegador o sistema puede enviar el audio a su proveedor, por ejemplo Google o Microsoft. Nemo no guarda ni el audio ni el texto reconocido, no escribe nada en registros y no pasa nada a la IA hasta que tú lo envías. El idioma sigue al idioma de la app.',
  noticeConfirm: 'Activar',
  noticeCancel: 'Ahora no',
  button: 'Hablar',
  buttonStop: 'Terminar grabación',
  listening: 'Escuchando …',
  listeningHint: (key: string) => `${key} o un toque termina. Esc cancela.`,
  listeningHintNoKey: 'Un toque termina. Esc cancela.',
  finishing: 'Un momento …',
  shortcutText: 'Hablar (mantener o tocar)',
  notices: {
    denied: 'El micrófono no está permitido. Puedes permitirlo en los ajustes del navegador.',
    silent: 'No he oído nada. Inténtalo de nuevo si quieres.',
    failed: 'La entrada de voz no funciona aquí ahora mismo. Escribir funciona como siempre.',
  },
  searchWords: [
    'Micrófono',
    'Dictado',
    'Hablar',
    'Pulsar para hablar',
    'Voz',
    'Reconocimiento de voz',
  ],
};
