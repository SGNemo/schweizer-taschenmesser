import type { Strings } from '@/strings';

export const feeds: Strings['feeds'] = {
  meta: {
    name: 'Feeds',
    description:
      'Tus feeds suscritos (noticias, blogs, podcasts) en un solo lugar, ordenados por grupo. Nemo no los descarga por sí mismo; un toque abre el sitio.',
    quickAdd: 'Añadir feed',
    settings: {
      grouped: 'Ordenar por grupos',
      groupedHelp:
        'Muestra los feeds bajo el nombre de su grupo; desactivado: una lista alfabética.',
    },
  },
  title: 'Feeds',
  add: 'Añadir feed',
  edit: 'Editar feed',
  remove: 'Quitar',
  empty: 'Aún no hay feeds',
  emptyHint: 'Escribe la dirección de un feed, por ejemplo de tu blog favorito.',
  listLabel: 'Feeds suscritos',
  ungrouped: 'Sin grupo',
  allFeeds: 'Todos los feeds',
  lead: 'Añadido hace poco',
  groupsCount: (g: number) => (g === 0 ? '' : g === 1 ? '1 grupo' : `${g} grupos`),
  importOpml: 'Importar',
  exportOpml: 'Exportar como OPML',
  exported: 'OPML guardado.',
  opmlTitle: 'Mis feeds',
  rowMenu: (name: string) => `Acciones para ${name}`,
  fields: {
    url: 'Dirección del feed',
    urlHint: 'Por ejemplo example.org/feed.xml',
    title: 'Nombre',
    titleHint: 'Déjalo vacío: Nemo usa el nombre del sitio web.',
    category: 'Grupo',
  },
  errors: {
    url: 'Eso no es una dirección web (http o https).',
    duplicate: 'Ya tienes este feed.',
  },
  widget: {
    label: 'Feeds',
    context: (n: number, g: number) =>
      `${n === 1 ? '1 feed' : `${n} feeds`}${g > 0 ? ` · ${g === 1 ? '1 grupo' : `${g} grupos`}` : ''}`,
    empty: 'Aún no hay feeds',
    add: 'Añadir feed',
  },
};
