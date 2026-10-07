import type { Strings } from '@/strings';

export const widgets: Strings['widgets'] = {
  done: 'Terminé',
  undo: 'Annuler',
  now: 'Maintenant',
  next: 'Ensuite',
  allDay: 'Toute la journée',
  tomorrow: 'Demain',
  more: (n: number) => `+ ${n} de plus`,
  invoicesSummary: (sum: string, overdue: number) =>
    overdue > 0 ? `${sum} ouvert · ${overdue} en retard` : `${sum} ouvert`,
  subsSummary: (monthly: string, next?: string) =>
    next ? `${monthly} par mois · prochain ${next}` : `${monthly} par mois`,
  todosSummaryCalm: (open: number, waiting: number) =>
    (open <= 1 ? `${open} ouverte` : `${open} ouvertes`) +
    (waiting > 0 ? ` · ${waiting} en attente` : ''),
  todosSummary: (open: number, overdue: number) =>
    (open <= 1 ? `${open} ouverte` : `${open} ouvertes`) +
    (overdue > 0 ? ` · ${overdue} en retard` : ''),
  shoppingSummary: (open: number) =>
    open <= 1 ? `${open} article restant` : `${open} articles restants`,
  budgetsSummary: (over: number) =>
    over === 0
      ? 'Tous les budgets sont respectés'
      : over === 1
        ? '1 budget dépassé'
        : `${over} budgets dépassés`,
  packingSummary: (packed: number, total: number) => `${packed} sur ${total} emballés`,
  contractsSummary: (n: number) =>
    n <= 1 ? `${n} délai de résiliation en vue` : `${n} délais de résiliation en vue`,
  expirySummary: (expired: number, soon: number) =>
    [expired ? `${expired} expiré${expired > 1 ? 's' : ''}` : '', soon ? `${soon} bientôt` : '']
      .filter(Boolean)
      .join(' · '),
  kpiAvailable: (amount: string) => `${amount} disponible`,
  kpiMonthNet: (amount: string) => `${amount} ce mois-ci`,
  kpiSeries: 'Solde en fin de mois, 6 derniers mois',
};
