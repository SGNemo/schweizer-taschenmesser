import type { Strings } from '@/strings';

export const budgets: Strings['budgets'] = {
  ext: {
    period: {
      label: 'Période',
      month: 'Mois',
      quarter: 'Trimestre',
      year: 'Année',
      quarterLabel: (q: number, year: number) => `T${q} ${year}`,
      perPeriod: (period: string) => `par ${period}`,
    },
    carry: {
      label: 'Reporter le reste sur la période suivante',
      hint: 'Ce qui reste agrandit le budget suivant ; ce qui a été dépassé le réduit (d’un budget au plus).',
      plus: (amount: string) => `dont ${amount} reportés`,
      minus: (amount: string) => `moins ${amount} reportés`,
    },
    warn: {
      label: 'Alerter à partir de (pourcentage)',
      hint: 'Vide = valeur par défaut des réglages.',
      title: (name: string, percent: number) => `${name} : ${percent} % du budget utilisé`,
    },
    forecast: {
      over: (amount: string) => `Au rythme actuel : environ ${amount} au-dessus du budget`,
    },
    history: {
      title: 'Historique',
      period: 'Période',
      spent: 'Dépensé',
      limit: 'Budget',
      bookings: 'Voir les opérations',
    },
    head: {
      free: 'Encore libre',
      context: (n: number, over: number) =>
        over === 0
          ? n === 1
            ? '1 budget, dans la limite'
            : `${n} budgets, tous dans la limite`
          : n === 1
            ? '1 budget, dépassé'
            : `${n} budgets, ${over} dépassés`,
      ring: (n: number) => `Répartition des dépenses sur ${n} budgets`,
    },
    goal: {
      rate: 'Versement mensuel prévu',
      rateHint: 'Facultatif : avec votre versement, vous voyez quand l’objectif est atteint.',
      start: 'Épargne depuis',
      startHint:
        'Facultatif : avec le début, vous voyez combien vous mettez de côté en moyenne par mois.',
      pace: (avg: string) => `Jusqu’ici, vous mettez de côté en moyenne ${avg} par mois.`,
      paceReach: (date: string) => `Au rythme actuel, vous atteignez l’objectif en ${date}.`,
      plan: (rate: string, date: string) =>
        `Avec ${rate} par mois, vous atteignez l’objectif en ${date}.`,
      inTime: 'Cela correspond à la date visée.',
      late: (months: number) =>
        months === 1
          ? 'C’est 1 mois après la date visée.'
          : `C’est ${months} mois après la date visée.`,
    },
    widget: { addExpense: 'Dépense +' },
    settings: {
      warnAtPercent: 'Alerter à partir de (pourcentage du budget)',
      warnAtPercentHelp:
        'À partir de cette part, un budget apparaît comme « presque épuisé ». Seul ce qui dépasse le budget passe au rouge.',
      showForecast: 'Afficher la prévision jusqu’à la fin de la période',
      showForecastHelp:
        'Une ligne par budget : où finissent les dépenses au rythme actuel, opérations récurrentes prévues comprises.',
    },
  },
  meta: {
    name: 'Budgets et objectifs d’épargne',
    description:
      'Limites mensuelles par catégorie de dépenses (depuis les Finances) et objectifs d’épargne avec versements et progression.',
    route: 'Budgets',
    widget: 'Budgets et objectifs d’épargne',
    quickAdd: 'Objectif d’épargne',
  },
  title: 'Budgets et objectifs d’épargne',
  tabs: 'Section',
  tabBudgets: 'Budgets',
  tabGoals: 'Objectifs d’épargne',
  addBudget: 'Ajouter un budget',
  editBudget: 'Modifier le budget',
  addGoal: 'Ajouter un objectif d’épargne',
  editGoal: 'Modifier l’objectif d’épargne',
  category: 'Catégorie',
  unknownCategory: 'Catégorie supprimée',
  limit: 'Limite par mois',
  needFinance: 'Les budgets nécessitent le module « Finances ».',
  needFinanceHint:
    'Activez-le dans la Bibliothèque de modules – les dépenses par catégorie viennent de là.',
  prevMonth: 'Mois précédent',
  nextMonth: 'Mois suivant',
  emptyBudgets:
    'Aucun budget pour l’instant. Fixez une limite mensuelle pour une catégorie de dépenses.',
  emptyGoals: 'Aucun objectif d’épargne pour l’instant.',
  spentOf: (spent: string, limit: string) => `${spent} sur ${limit}`,
  left: (amount: string) => `reste ${amount}`,
  over: (amount: string) => `${amount} de dépassement`,
  goalName: 'Pour quoi épargnez-vous ?',
  target: 'Montant visé',
  deadline: 'Jusqu’au (facultatif)',
  until: (date: string) => `jusqu’au ${date}`,
  remaining: 'Reste à épargner',
  reached: 'Atteint',
  perMonth: (amount: string) => `D’ici l’échéance : mettre de côté ${amount} par mois`,
  deposit: 'Verser',
  depositTitle: (name: string) => `Versement : ${name}`,
  depositIn: 'Versement',
  depositOut: 'Retrait',
  kind: 'Type',
  history: 'Historique',
  historyTitle: (name: string) => `Historique : ${name}`,
  noDeposits: 'Aucun versement pour l’instant.',
  widgetEmpty: 'Rien à signaler.',
};
