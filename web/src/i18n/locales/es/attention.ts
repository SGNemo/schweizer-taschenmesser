import type { Strings } from '@/strings';

export const attention: Strings['attention'] = {
  title: 'Importante ahora',
  hint: 'Lo vencido, lo que vence hoy y lo que caduca, arriba del todo.',
  invoicesOverdue: (n: number) => (n === 1 ? '1 factura vencida' : `${n} facturas vencidas`),
  invoicesToday: (n: number) => (n === 1 ? '1 factura vence hoy' : `${n} facturas vencen hoy`),
  todosOverdue: (n: number) => (n === 1 ? '1 tarea vencida' : `${n} tareas vencidas`),
  todosToday: (n: number) => (n === 1 ? '1 tarea vence hoy' : `${n} tareas vencen hoy`),
  eventNext: (title: string) => title,
  eventAt: (time: string) => `hoy a las ${time}`,
  budgetOver: (name: string) => `Presupuesto «${name}» superado`,
  pantryExpired: (n: number) =>
    n === 1 ? '1 producto de la despensa caducado' : `${n} productos de la despensa caducados`,
  pantrySoon: (n: number) =>
    n === 1
      ? '1 producto de la despensa caduca pronto'
      : `${n} productos de la despensa caducan pronto`,
  docsExpired: (n: number) => (n === 1 ? '1 documento caducado' : `${n} documentos caducados`),
  docsSoon: (n: number) =>
    n === 1 ? '1 documento caduca pronto' : `${n} documentos caducan pronto`,
  contractsAct: (n: number) =>
    n === 1
      ? '1 plazo de cancelación termina pronto'
      : `${n} plazos de cancelación terminan pronto`,
  driveFull: (name: string) => `Unidad ${name} casi llena`,
  updateAvailable: 'Actualización disponible',
  waiting: (n: number) => `En espera · ${n}`,
  nothingNow: 'Nada de esto tiene que ser ahora.',
  todosWaiting: (n: number) => (n === 1 ? '1 tarea en espera' : `${n} tareas en espera`),
  todosWaitingDetail: 'Puedes replanificar',
};
