import type { Strings } from '@/strings';

export const bookmarks: Strings['bookmarks'] = {
  meta: {
    name: 'Salvos',
    description:
      'Guarde links, leituras, filmes, lugares e ideias – com tags, filtros e status de concluído; links usados com frequência como blocos de marcadores. No celular, também pelo “Compartilhar” de outros apps.',
    route: 'Salvos',
    widget: 'Salvos',
    widgetLinks: 'Marcadores',
    quickAdd: 'Item salvo',
  },
  title: 'Salvos',
  add: 'Salvar',
  edit: 'Editar item salvo',
  url: 'Endereço (link)',
  urlInvalid: 'Informe um endereço http(s) válido.',
  kind: 'Tipo',
  kinds: {
    link: 'Link',
    read: 'Ler',
    watch: 'Assistir',
    place: 'Lugar',
    idea: 'Ideia',
    other: 'Outros',
  } as Record<string, string>,
  allKinds: 'Todos os tipos',
  tags: 'Tags',
  tagsHint: 'Separe com vírgula, por exemplo receita, férias',
  filterTags: 'Filtrar por tag',
  search: 'Buscar nos salvos',
  view: 'Status',
  views: { open: 'Abertos', done: 'Concluídos', all: 'Todos' },
  tabsLabel: 'Visualização',
  tabList: 'Salvos',
  tabLinks: 'Marcadores',
  addLink: 'Adicionar marcador',
  linksWidgetEmpty: 'Ainda não há marcadores.',
  noGroup: 'Sem grupo',
  linksEmpty:
    'Ainda não há marcadores. Adicione links que você usa com frequência – agrupados pela primeira tag.',
  empty: 'Nada salvo ainda.',
  emptyFiltered: 'Nada encontrado.',
  open: 'Abrir link',
  done: 'Concluído',
  widgetEmpty: 'Nada salvo.',
  openCount: (n: number) =>
    n === 0 || n === 1 ? `${n} item salvo aberto` : `${n} itens salvos abertos`,
};
