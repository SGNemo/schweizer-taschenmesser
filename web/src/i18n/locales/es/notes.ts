import type { Strings } from '@/strings';

export const notes: Strings['notes'] = {
  meta: {
    name: 'Notas',
    description:
      'Notas rápidas con título y texto, un bloc rápido fijo siempre arriba, fija las notas importantes, con búsqueda.',
    route: 'Notas',
    widget: 'Notas',
    quickAdd: 'Nota',
  },
  title: 'Notas',
  add: 'Añadir nota',
  edit: 'Editar nota',
  body: 'Texto',
  pin: 'Fijar arriba',
  scratch: 'Bloc rápido',
  scratchHint: 'Para apuntes rápidos, siempre arriba.',
  scratchClear: 'Vaciar bloc rápido',
  search: 'Buscar en notas',
  empty: 'Aún no hay notas.',
  emptyFiltered: 'No se encontró nada.',
  widgetEmpty: 'Aún no hay notas.',
};
