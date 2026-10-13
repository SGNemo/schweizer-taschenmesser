import type { Strings } from '@/strings';

export const pendingImport: Strings['pendingImport'] = {
  title: 'Importación pendiente',
  banner: (source: string, n: number, module: string) =>
    `${source || 'Una IA'} quiere añadir ${n === 1 ? '1 entrada' : `${n} entradas`} a «${module}».`,
  review: 'Ver',
  dialogTitle: (module: string) => `Revisar importación: ${module}`,
  intro: (source: string) =>
    `Enviado a través del acceso «${source}». Solo se guardan las entradas marcadas; los cambios en entradas existentes tienes que marcarlos uno a uno.`,
  accept: (n: number) => (n === 1 ? 'Añadir 1 entrada' : `Añadir ${n} entradas`),
  reject: 'Rechazar',
  accepted: (n: number, conflicts: number) =>
    `${n === 1 ? '1 entrada añadida' : `${n} entradas añadidas`}.` +
    (conflicts > 0
      ? ` ${conflicts === 1 ? '1 cambio omitido' : `${conflicts} cambios omitidos`} porque la entrada se editó mientras tanto.`
      : ''),
  rejected: 'Importación rechazada.',
  failed: 'No ha funcionado. Inténtalo de nuevo.',
};
