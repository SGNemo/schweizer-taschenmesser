import type { Strings } from '@/strings';

export const widgets: Strings['widgets'] = {
  done: 'Hecho',
  undo: 'Deshacer',
  now: 'Ahora',
  next: 'Lo siguiente',
  allDay: 'Todo el día',
  tomorrow: 'Mañana',
  more: (n: number) => `+ ${n} más`,
  invoicesSummary: (sum: string, overdue: number) =>
    overdue > 0 ? `${sum} pendiente · ${overdue} vencidas` : `${sum} pendiente`,
  subsSummary: (monthly: string, next?: string) =>
    next ? `${monthly} al mes · próximo ${next}` : `${monthly} al mes`,
  todosSummaryCalm: (open: number, waiting: number) =>
    (open === 1 ? '1 pendiente' : `${open} pendientes`) +
    (waiting > 0 ? ` · ${waiting} en espera` : ''),
  todosSummary: (open: number, overdue: number) =>
    (open === 1 ? '1 pendiente' : `${open} pendientes`) +
    (overdue > 0 ? ` · ${overdue} ${overdue === 1 ? 'vencida' : 'vencidas'}` : ''),
  shoppingSummary: (open: number) =>
    open === 1 ? '1 artículo pendiente' : `${open} artículos pendientes`,
  budgetsSummary: (over: number) =>
    over === 0
      ? 'Todos los presupuestos en orden'
      : over === 1
        ? '1 presupuesto superado'
        : `${over} presupuestos superados`,
  packingSummary: (packed: number, total: number) => `${packed} de ${total} en la maleta`,
  contractsSummary: (n: number) =>
    n === 1 ? '1 plazo de cancelación a la vista' : `${n} plazos de cancelación a la vista`,
  expirySummary: (expired: number, soon: number) =>
    [
      expired ? `${expired} ${expired === 1 ? 'caducado' : 'caducados'}` : '',
      soon ? `${soon} pronto` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  kpiAvailable: (amount: string) => `${amount} disponible`,
  kpiMonthNet: (amount: string) => `${amount} este mes`,
  kpiSeries: 'Saldo a fin de mes, últimos 6 meses',
};
