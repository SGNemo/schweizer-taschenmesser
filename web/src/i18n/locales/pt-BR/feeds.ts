import type { Strings } from '@/strings';

export const feeds: Strings['feeds'] = {
  meta: {
    name: 'Feeds',
    description:
      'Seus feeds assinados (notícias, blogs, podcasts) em um só lugar, organizados por grupo. O Nemo não os busca sozinho; um toque abre o site.',
    quickAdd: 'Adicionar feed',
    settings: {
      grouped: 'Organizar por grupos',
      groupedHelp: 'Mostra os feeds sob o nome do grupo; desligado: uma lista alfabética.',
    },
  },
  title: 'Feeds',
  add: 'Adicionar feed',
  edit: 'Editar feed',
  remove: 'Remover',
  empty: 'Ainda não há feeds',
  emptyHint: 'Digite o endereço de um feed, por exemplo do seu blog favorito.',
  listLabel: 'Feeds assinados',
  ungrouped: 'Sem grupo',
  allFeeds: 'Todos os feeds',
  importOpml: 'Importar',
  exportOpml: 'Exportar como OPML',
  exported: 'OPML salvo.',
  opmlTitle: 'Meus feeds',
  rowMenu: (name: string) => `Ações para ${name}`,
  fields: {
    url: 'Endereço do feed',
    urlHint: 'Por exemplo example.org/feed.xml',
    title: 'Nome',
    titleHint: 'Deixe vazio: o Nemo usa o nome do site.',
    category: 'Grupo',
  },
  errors: {
    url: 'Isso não é um endereço web (http ou https).',
    duplicate: 'Você já tem este feed.',
  },
  widget: {
    label: 'Feeds',
    context: (n: number, g: number) =>
      `${n === 1 ? '1 feed' : `${n} feeds`}${g > 0 ? ` · ${g === 1 ? '1 grupo' : `${g} grupos`}` : ''}`,
    empty: 'Ainda não há feeds',
    add: 'Adicionar feed',
  },
};
