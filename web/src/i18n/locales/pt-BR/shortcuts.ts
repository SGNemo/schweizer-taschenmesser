import type { Strings } from '@/strings';

export const shortcuts: Strings['shortcuts'] = {
  title: 'Atalhos de teclado',
  hint: 'Letras sozinhas só funcionam quando você não está digitando em um campo.',
  items: [
    { keys: ['Ctrl', 'K'], text: 'Buscar ou perguntar' },
    { keys: ['N'], text: 'Criar novo' },
    { keys: ['G', 'depois H'], text: 'Ir para a visão geral' },
    {
      keys: ['G', 'depois P / G / A / W / T'],
      text: 'Ir para Planejar, Dinheiro, Casa, Conhecimento, Cofre',
    },
    { keys: ['J', 'K'], text: 'Próxima / linha anterior (também ↓ ↑)' },
    { keys: ['Enter'], text: 'Abrir linha' },
    { keys: ['E'], text: 'Editar linha' },
    { keys: ['Espaço'], text: 'Marcar linha' },
    { keys: ['/'], text: 'Buscar na lista' },
    { keys: ['Ctrl', 'Z'], text: 'Desfazer a última ação' },
    { keys: ['Alt', 'L'], text: 'Ligar ou desligar a ajuda de leitura' },
    { keys: ['Esc'], text: 'Fechar / desfazer seleção' },
    { keys: ['Alt', 'Home'], text: 'Ir para a visão geral' },
    { keys: ['?'], text: 'Esta lista' },
  ],
};
