import type { Strings } from '@/strings';

export const homeEdit: Strings['homeEdit'] = {
  showMore: (n: number) => (n === 1 ? 'Mostrar más · 1 tarjeta' : `Mostrar más · ${n} tarjetas`),
  showLess: 'Solo lo importante',
  pinStart: 'Añadir tarjeta…',
  pin: (title: string) => `Añadir ${title}`,
  unpin: (title: string) => `Quitar ${title}`,
  pinned: 'Añadida',
  pinNote: 'Las tarjetas añadidas siguen visibles en la vista tranquila.',
  customize: 'Personalizar',
  done: 'Listo',
  hide: 'Ocultar',
  show: 'Mostrar',
  handle: (title: string) => `Mover ${title}`,
  hidden: 'Oculto',
  instructions:
    'Para mover, pulsa Espacio, desplázalo con las flechas y suéltalo con Espacio. Esc cancela.',
  picked: (title: string) => `${title} seleccionado.`,
  moved: (title: string, pos: number) => `${title} movido a la posición ${pos}.`,
  dropped: (title: string, pos: number) => `${title} colocado en la posición ${pos}.`,
  cancelled: 'Movimiento cancelado.',
  widgets: 'Tarjetas',
  widgetsTitle: 'Tarjetas del resumen',
  widgetsNote:
    'Ocultar solo afecta al resumen; el módulo sigue activo. Puedes desactivar módulos en la biblioteca.',
  widgetsNone: 'No hay módulos activos con tarjetas.',
  reset: 'Restablecer',
  resetTitle: '¿Restablecer el resumen?',
  resetText:
    'El orden, los tamaños y las tarjetas ocultas vuelven a los valores predeterminados. Tus módulos y datos no cambian.',
  resetConfirm: 'Restablecer valores',
  cancel: 'Cancelar',
  size: (title: string) => `Tamaño de ${title}`,
  sizeOptions: { s: 'S', m: 'M', l: 'L' } as Record<string, string>,
};
