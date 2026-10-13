import type { Strings } from '@/strings';

export const bookmarks: Strings['bookmarks'] = {
  meta: {
    name: 'Guardados',
    description:
      'Guarda enlaces, lecturas, películas, lugares e ideas, con etiquetas, filtros y estado de hecho; los enlaces que usas a menudo, como mosaicos de marcadores. En el móvil también con «Compartir» desde otras apps.',
    route: 'Guardados',
    widget: 'Guardados',
    widgetLinks: 'Marcadores',
    quickAdd: 'Elemento guardado',
  },
  title: 'Guardados',
  add: 'Guardar',
  edit: 'Editar elemento guardado',
  url: 'Dirección (enlace)',
  urlInvalid: 'Introduce una dirección http(s) válida.',
  kind: 'Tipo',
  kinds: {
    link: 'Enlace',
    read: 'Leer',
    watch: 'Ver',
    place: 'Lugar',
    idea: 'Idea',
    other: 'Otros',
  } as Record<string, string>,
  allKinds: 'Todos los tipos',
  tags: 'Etiquetas',
  tagsHint: 'Separa con comas, p. ej. receta, vacaciones',
  filterTags: 'Filtrar por etiqueta',
  search: 'Buscar en Guardados',
  view: 'Estado',
  views: { open: 'Pendientes', done: 'Hechos', all: 'Todos' },
  tabsLabel: 'Vista',
  tabList: 'Guardados',
  tabLinks: 'Marcadores',
  addLink: 'Añadir marcador',
  linksWidgetEmpty: 'Aún no hay marcadores.',
  noGroup: 'Sin grupo',
  linksEmpty:
    'Aún no hay marcadores. Añade los enlaces que usas a menudo, agrupados por la primera etiqueta.',
  empty: 'Aún no has guardado nada.',
  emptyFiltered: 'No se encontró nada.',
  open: 'Abrir enlace',
  done: 'Hecho',
  widgetEmpty: 'Nada guardado.',
  openCount: (n: number) =>
    n === 1 ? '1 elemento guardado pendiente' : `${n} elementos guardados pendientes`,
};
