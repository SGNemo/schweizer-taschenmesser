import type { Strings } from '@/strings';

export const attention: Strings['attention'] = {
  title: 'Important maintenant',
  hint: 'Ce qui est en retard, à échéance aujourd’hui ou expire, tout en haut.',
  invoicesOverdue: (n: number) => (n <= 1 ? `${n} facture en retard` : `${n} factures en retard`),
  invoicesToday: (n: number) =>
    n <= 1 ? `${n} facture à échéance aujourd’hui` : `${n} factures à échéance aujourd’hui`,
  todosOverdue: (n: number) => (n <= 1 ? `${n} tâche en retard` : `${n} tâches en retard`),
  todosToday: (n: number) =>
    n <= 1 ? `${n} tâche à échéance aujourd’hui` : `${n} tâches à échéance aujourd’hui`,
  eventNext: (title: string) => title,
  eventAt: (time: string) => `aujourd’hui à ${time}`,
  budgetOver: (name: string) => `Budget « ${name} » dépassé`,
  pantryExpired: (n: number) => (n <= 1 ? `${n} provision périmée` : `${n} provisions périmées`),
  pantrySoon: (n: number) =>
    n <= 1 ? `${n} provision bientôt périmée` : `${n} provisions bientôt périmées`,
  docsExpired: (n: number) => (n <= 1 ? `${n} document expiré` : `${n} documents expirés`),
  docsSoon: (n: number) =>
    n <= 1 ? `${n} document expire bientôt` : `${n} documents expirent bientôt`,
  contractsAct: (n: number) =>
    n <= 1
      ? `${n} délai de résiliation expire bientôt`
      : `${n} délais de résiliation expirent bientôt`,
  driveFull: (name: string) => `Lecteur ${name} presque plein`,
  updateAvailable: 'Mise à jour disponible',
  waiting: (n: number) => `En attente · ${n}`,
  nothingNow: 'Rien de tout cela ne presse.',
  todosWaiting: (n: number) => (n <= 1 ? `${n} tâche en attente` : `${n} tâches en attente`),
  todosWaitingDetail: 'Vous pouvez les replanifier',
};
