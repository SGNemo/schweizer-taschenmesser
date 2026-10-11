import type { Strings } from '@/strings';

export const notes: Strings['notes'] = {
  meta: {
    name: 'Notas',
    description:
      'Notas rápidas com título e texto, um rascunho fixo sempre no topo, fixe notas importantes, com busca.',
    route: 'Notas',
    widget: 'Notas',
    quickAdd: 'Nota',
  },
  title: 'Notas',
  add: 'Adicionar nota',
  edit: 'Editar nota',
  body: 'Texto',
  pin: 'Fixar no topo',
  scratch: 'Rascunho',
  scratchHint: 'Para anotações rápidas, sempre no topo.',
  scratchClear: 'Limpar rascunho',
  search: 'Buscar notas',
  empty: 'Ainda não há notas.',
  emptyFiltered: 'Nada encontrado.',
  widgetEmpty: 'Ainda não há notas.',
};
