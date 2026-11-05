import type { Strings } from '@/strings';

export const budgets: Strings['budgets'] = {
  ext: {
    period: {
      label: 'Periodo',
      month: 'Mes',
      quarter: 'Trimestre',
      year: 'Año',
      quarterLabel: (q: number, year: number) => `T${q} ${year}`,
      perPeriod: (period: string) => `por ${period}`,
    },
    carry: {
      label: 'Pasar el resto al periodo siguiente',
      hint: 'Lo que sobra amplía el siguiente presupuesto; lo que se pasó lo reduce (como mucho en un presupuesto).',
      plus: (amount: string) => `incl. ${amount} de remanente`,
      minus: (amount: string) => `menos ${amount} de remanente`,
    },
    warn: {
      label: 'Avisar desde (porcentaje)',
      hint: 'Vacío = valor por defecto de los ajustes.',
      title: (name: string, percent: number) => `${name}: ${percent} % del presupuesto gastado`,
    },
    forecast: {
      over: (amount: string) => `Al ritmo actual: unos ${amount} por encima del presupuesto`,
    },
    history: {
      title: 'Historial',
      period: 'Periodo',
      spent: 'Gastado',
      limit: 'Presupuesto',
      bookings: 'Ver movimientos',
    },
    head: {
      free: 'Aún libre',
      chip: (name: string, pct: number) => `${name} ${pct} %`,
      context: (n: number, over: number) =>
        over === 0
          ? n === 1
            ? '1 presupuesto, dentro del límite'
            : `${n} presupuestos, todos dentro del límite`
          : n === 1
            ? '1 presupuesto, superado'
            : `${n} presupuestos, ${over} superados`,
      ring: (n: number) => `Reparto del gasto entre ${n} presupuestos`,
    },
    goal: {
      rate: 'Aportación mensual prevista',
      rateHint: 'Opcional: con tu aportación ves cuándo se alcanza la meta.',
      start: 'Ahorrando desde',
      startHint: 'Opcional: con el inicio ves cuánto apartas de media al mes.',
      pace: (avg: string) => `Hasta ahora apartas de media ${avg} al mes.`,
      paceReach: (date: string) => `Al ritmo actual alcanzas la meta en ${date}.`,
      plan: (rate: string, date: string) => `Con ${rate} al mes llegas a la meta en ${date}.`,
      inTime: 'Encaja con la fecha objetivo.',
      late: (months: number) =>
        months === 1
          ? 'Es 1 mes después de la fecha objetivo.'
          : `Son ${months} meses después de la fecha objetivo.`,
    },
    widget: { addExpense: 'Gasto +' },
    settings: {
      warnAtPercent: 'Avisar desde (porcentaje del presupuesto)',
      warnAtPercentHelp:
        'Desde esta parte, un presupuesto aparece como «casi agotado». Solo lo que supera el presupuesto se pone en rojo.',
      showForecast: 'Mostrar la previsión hasta el final del periodo',
      showForecastHelp:
        'Una línea por presupuesto: dónde acaba el gasto al ritmo actual, con los movimientos recurrentes previstos.',
    },
  },
  meta: {
    name: 'Presupuestos y metas de ahorro',
    description:
      'Límites mensuales por categoría de gasto (de Finanzas) y metas de ahorro con aportaciones y progreso.',
    route: 'Presupuestos',
    widget: 'Presupuestos y metas de ahorro',
    quickAdd: 'Meta de ahorro',
  },
  title: 'Presupuestos y metas de ahorro',
  tabs: 'Sección',
  tabBudgets: 'Presupuestos',
  tabGoals: 'Metas de ahorro',
  addBudget: 'Añadir presupuesto',
  editBudget: 'Editar presupuesto',
  addGoal: 'Añadir meta de ahorro',
  editGoal: 'Editar meta de ahorro',
  category: 'Categoría',
  unknownCategory: 'Categoría eliminada',
  limit: 'Límite al mes',
  needFinance: 'Los presupuestos necesitan el módulo «Finanzas».',
  needFinanceHint: 'Actívalo en la biblioteca de módulos: los gastos por categoría vienen de ahí.',
  prevMonth: 'Mes anterior',
  nextMonth: 'Mes siguiente',
  emptyBudgets: 'Aún no hay presupuestos. Fija un límite mensual para una categoría de gasto.',
  emptyGoals: 'Aún no hay metas de ahorro.',
  spentOf: (spent: string, limit: string) => `${spent} de ${limit}`,
  left: (amount: string) => `quedan ${amount}`,
  over: (amount: string) => `${amount} por encima`,
  goalName: '¿Para qué ahorras?',
  target: 'Importe objetivo',
  deadline: 'Hasta (opcional)',
  until: (date: string) => `hasta ${date}`,
  remaining: 'Falta',
  reached: 'Conseguida',
  perMonth: (amount: string) => `Hasta la fecha: ahorra ${amount} al mes`,
  deposit: 'Aportar',
  depositTitle: (name: string) => `Aportación: ${name}`,
  depositIn: 'Aportación',
  depositOut: 'Retirada',
  kind: 'Tipo',
  history: 'Historial',
  historyTitle: (name: string) => `Historial: ${name}`,
  noDeposits: 'Aún no hay aportaciones.',
  widgetEmpty: 'Nada que destacar.',
};
