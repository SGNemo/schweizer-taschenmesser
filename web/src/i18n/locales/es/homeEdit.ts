import type { Strings } from '@/strings';

export const homeEdit: Strings['homeEdit'] = {
  calmNote: (n: number) =>
    n === 1
      ? 'Vista tranquila: 1 widget está oculto.'
      : `Vista tranquila: ${n} widgets están ocultos.`,
  showAll: 'Mostrar todos los widgets',
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
  widgets: 'Widgets',
  widgetsTitle: 'Widgets del resumen',
  widgetsNote:
    'Ocultar solo afecta al resumen; el módulo sigue activo. Puedes desactivar módulos en la biblioteca.',
  widgetsNone: 'No hay módulos activos con widgets.',
  reset: 'Restablecer',
  resetTitle: '¿Restablecer el resumen?',
  resetText:
    'El orden, los tamaños y los widgets ocultos vuelven a los valores predeterminados. Tus módulos y datos no cambian.',
  resetConfirm: 'Restablecer valores',
  cancel: 'Cancelar',
  size: (title: string) => `Tamaño de ${title}`,
  sizeOptions: { s: 'S', m: 'M', l: 'L' } as Record<string, string>,
};
