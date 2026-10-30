import type { Strings } from '@/strings';

export const homeEdit: Strings['homeEdit'] = {
  showMore: (n: number) => (n <= 1 ? `Mostrar mais · ${n} cartão` : `Mostrar mais · ${n} cartões`),
  pinStart: 'Adicionar cartão…',
  pin: (title: string) => `Adicionar ${title}`,
  unpin: (title: string) => `Remover ${title}`,
  pinned: 'Adicionado',
  pinNote: 'Cartões adicionados continuam visíveis na visualização calma.',
  customize: 'Personalizar',
  done: 'Pronto',
  hide: 'Ocultar',
  show: 'Mostrar',
  handle: (title: string) => `Mover ${title}`,
  hidden: 'Oculto',
  instructions:
    'Para mover, pressione Espaço, use as setas e pressione Espaço de novo para soltar. Esc cancela.',
  picked: (title: string) => `${title} selecionado.`,
  moved: (title: string, pos: number) => `${title} movido para a posição ${pos}.`,
  dropped: (title: string, pos: number) => `${title} solto na posição ${pos}.`,
  cancelled: 'Movimento cancelado.',
  widgets: 'Cartões',
  widgetsTitle: 'Cartões da visão geral',
  widgetsNote:
    'Ocultar afeta só a visão geral, o módulo continua ativo. Você pode desativar módulos na biblioteca.',
  widgetsNone: 'Nenhum módulo ativo com cartões.',
  reset: 'Redefinir',
  resetTitle: 'Redefinir a visão geral?',
  resetText: 'Ordem, tamanhos e cartões ocultos voltam ao padrão. Seus módulos e dados não mudam.',
  resetConfirm: 'Voltar ao padrão',
  cancel: 'Cancelar',
  size: (title: string) => `Tamanho de ${title}`,
  sizeOptions: { s: 'P', m: 'M', l: 'G' } as Record<string, string>,
};
