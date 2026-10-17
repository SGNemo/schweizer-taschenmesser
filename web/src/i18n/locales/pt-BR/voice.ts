import type { Strings } from '@/strings';

export const voice: Strings['voice'] = {
  title: 'Entrada de voz',
  intro:
    'Aperte uma tecla para falar com a busca e a IA. O texto reconhecido vai para o campo de entrada; você mesmo envia.',
  enable: 'Usar entrada de voz',
  enableHint: 'Desativada até você ativar.',
  unavailable:
    'Indisponível aqui: este dispositivo ou navegador não tem reconhecimento de voz. Digitar funciona como sempre.',
  key: 'Tecla no app',
  keyHint: 'Segure e fale, ou toque uma vez e toque de novo para terminar. Esc cancela.',
  keyRecord: 'Mudar tecla',
  keyRecording: 'Aperte uma tecla …',
  keyOff: 'Sem tecla',
  keyClear: 'Remover',
  keyDefault: 'Padrão',
  keyInvalid: 'Use uma tecla de F1 a F12, ou uma tecla junto com Ctrl ou Alt.',
  globalKey: 'Tecla do sistema',
  globalHint:
    'Também vale com o Nemo em segundo plano: um toque inicia e o próximo termina a gravação.',
  globalErrors: {
    invalid: 'Esta combinação de teclas não é compreendida.',
    taken: 'Outro programa já usa esta combinação de teclas.',
    failed: 'Não foi possível definir a tecla.',
  },
  noticeTitle: 'Ativar a entrada de voz?',
  noticeText:
    'Para reconhecer a fala, seu navegador ou sistema pode enviar o áudio ao provedor, por exemplo Google ou Microsoft. O Nemo não guarda nem o áudio nem o texto reconhecido, não escreve nada em registros e não passa nada à IA até você enviar. O idioma segue o idioma do app.',
  noticeConfirm: 'Ativar',
  noticeCancel: 'Agora não',
  button: 'Falar',
  buttonStop: 'Terminar gravação',
  listening: 'Estou ouvindo …',
  listeningHint: (key: string) => `${key} ou um toque termina. Esc cancela.`,
  listeningHintNoKey: 'Um toque termina. Esc cancela.',
  finishing: 'Só um momento …',
  shortcutText: 'Falar (segurar ou tocar)',
  notices: {
    denied: 'O microfone não está liberado. Você pode permitir nas configurações do navegador.',
    silent: 'Não ouvi nada. Pode tentar de novo.',
    failed: 'A entrada de voz não funciona aqui no momento. Digitar funciona como sempre.',
  },
  searchWords: [
    'Microfone',
    'Ditado',
    'Falar',
    'Apertar para falar',
    'Voz',
    'Reconhecimento de voz',
  ],
};
