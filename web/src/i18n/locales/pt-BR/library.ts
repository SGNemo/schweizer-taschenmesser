import type { Strings } from '@/strings';

export const library: Strings['library'] = {
  title: 'Biblioteca de módulos',
  intro: 'Ative só o que você precisa. Módulos desativados ficam invisíveis.',
  other: 'Outros módulos',
  active: 'Ativo',
  nowActive: (name: string) => `O módulo “${name}” agora está ligado.`,
  inactive: 'Inativo',
  disableTitle: (name: string) => `Desativar “${name}”?`,
  disableText: 'O que deve acontecer com os dados salvos deste módulo?',
  keepData: 'Manter dados (ocultos)',
  keepDataHint: 'Ao ativar de novo, tudo volta.',
  deleteData: 'Excluir dados',
  deleteDataHint: 'Todas as entradas deste módulo serão removidas.',
  devOnly: 'Desenvolvedor',
};
