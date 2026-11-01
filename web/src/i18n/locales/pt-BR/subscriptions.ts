import type { Strings } from '@/strings';

export const subscriptions: Strings['subscriptions'] = {
  importDetail: (amount: string, rhythm: string, next: string) =>
    `${amount} · ${rhythm} · próxima cobrança ${next}`,
  cancelTitle: (name: string) => `Prazo de cancelamento termina: ${name}`,
  cancelBody: (last: string, amount: string, charge: string) =>
    `Último dia: ${last} – senão ${amount} em ${charge}`,
  cancelCalendar: (name: string) => `Prazo de cancelamento: ${name}`,
  meta: {
    name: 'Assinaturas',
    description:
      'Assinaturas e pagamentos recorrentes: próxima cobrança, prazo de cancelamento e o total por mês e por ano.',
    route: 'Assinaturas',
    widget: 'Próximas cobranças',
    quickAdd: 'Assinatura',
    settings: {
      cancelRemindDaysBefore: 'Lembrete antes do fim do prazo de cancelamento (dias)',
      cancelRemindDaysBeforeHelp: '0 = no último dia do prazo',
      remindTime: 'Horário do lembrete',
      remindTimeHelp: 'Formato HH:mm',
      priceHint: 'Aviso de aumento de preço',
      priceHintHelp:
        'Mostra uma vez em “Importante agora” quando uma assinatura fica mais cara. Você pode desativar a qualquer momento.',
    },
  },
  title: 'Assinaturas',
  add: 'Adicionar assinatura',
  edit: 'Editar assinatura',
  name: 'Nome',
  firstCharge: 'Cobrança em',
  noticeDays: 'Prazo de cancelamento (dias antes da cobrança)',
  noticeHint: 'Deixe vazio se dá para cancelar a qualquer momento.',
  active: 'Ativa',
  paused: 'Pausada',
  pause: 'Pausar',
  resume: 'Retomar',
  empty: 'Ainda não há assinaturas.',
  perMonth: 'Por mês',
  perYear: 'Por ano',
  nextCharge: 'Próxima cobrança',
  cancelBy: 'Cancelar até',
  ended: 'Encerrada',
  cancelledTo: 'Cancelado para (opcional)',
  cancelledToHint: 'Depois disso não há mais cobranças nem prazos.',
  cancelledBadge: (date: string) => `Cancelado para ${date}`,
  priceHistory: 'Histórico de preços',
  priceChange: (date: string, from: string, to: string, pct: number) =>
    `${date}: ${from} → ${to} (${pct > 0 ? '+' : ''}${pct} %)`,
  priceUp: (pct: number) => `Preço aumentado (+${pct} %)`,
  every: 'Intervalo',
  widgetEmpty: 'Nenhuma assinatura ativa.',
  monthlyCost: (v: string) => `≙ ${v} por mês`,
};
