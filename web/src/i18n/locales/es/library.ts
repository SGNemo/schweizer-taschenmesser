import type { Strings } from '@/strings';

export const library: Strings['library'] = {
  title: 'Biblioteca de módulos',
  intro: 'Activa solo lo que necesitas. Los módulos desactivados no se ven.',
  other: 'Más módulos',
  active: 'Activo',
  nowActive: (name: string) => `El módulo «${name}» ya está activado.`,
  inactive: 'Inactivo',
  disableTitle: (name: string) => `¿Desactivar «${name}»?`,
  disableText: '¿Qué hacemos con los datos guardados de este módulo?',
  keepData: 'Conservar datos (ocultos)',
  keepDataHint: 'Si lo vuelves a activar, todo estará ahí.',
  deleteData: 'Eliminar datos',
  deleteDataHint: 'Se eliminarán todas las entradas de este módulo.',
  devOnly: 'Desarrolladores',
};
