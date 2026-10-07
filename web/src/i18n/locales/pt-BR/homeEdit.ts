import type { Strings } from '@/strings';

export const homeEdit: Strings['homeEdit'] = {
  calmNote: (n: number) =>
    n === 0 || n === 1
      ? `Visualização calma: ${n} widget está oculto.`
      : `Visualização calma: ${n} widgets estão ocultos.`,
  showAll: 'Mostrar todos os widgets',
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
  widgets: 'Widgets',
  widgetsTitle: 'Widgets da visão geral',
  widgetsNote:
    'Ocultar afeta só a visão geral, o módulo continua ativo. Você pode desativar módulos na biblioteca.',
  widgetsNone: 'Nenhum módulo ativo com widgets.',
  reset: 'Redefinir',
  resetTitle: 'Redefinir a visão geral?',
  resetText: 'Ordem, tamanhos e widgets ocultos voltam ao padrão. Seus módulos e dados não mudam.',
  resetConfirm: 'Voltar ao padrão',
  cancel: 'Cancelar',
  size: (title: string) => `Tamanho de ${title}`,
  sizeOptions: { s: 'P', m: 'M', l: 'G' } as Record<string, string>,
};
