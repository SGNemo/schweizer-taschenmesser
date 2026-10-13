import type { Strings } from '@/strings';

export const calendar: Strings['calendar'] = {
  dayLabel: (day: string, n: number) =>
    n === 0 ? day : n === 1 ? `${day}, 1 registro` : `${day}, ${n} registros`,
  meta: {
    name: 'Calendário',
    description:
      'Eventos nas visões de mês, semana e dia – mostra também vencimentos e prazos de outros módulos (Tarefas, Lembretes, Faturas, Assinaturas, Contratos, Aniversários, Despensa).',
    route: 'Calendário',
    widget: 'Hoje e amanhã',
    quickAdd: 'Evento',
    settings: {
      defaultView: 'Visão padrão',
      defaultView_month: 'Mês',
      defaultView_week: 'Semana',
      defaultView_day: 'Dia',
      defaultReminderTime: 'Horário padrão para novos lembretes',
      allDayNotifyTime: 'Horário da notificação para eventos de dia inteiro',
      timeHelp: 'Formato HH:mm, ex.: 09:00',
    },
  },
  title: 'Calendário',
  today: 'Hoje',
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  view: 'Visão',
  prev: 'Anterior',
  next: 'Próximo',
  newEvent: 'Novo evento',
  editEvent: 'Editar evento',
  allDay: 'Dia inteiro',
  start: 'Início',
  end: 'Fim',
  location: 'Local',
  showOnMap: 'Mostrar no mapa',
  nothing: 'Nenhum registro',
  endBeforeStart: 'O fim não pode ser antes do início.',
  more: (n: number) => `+${n} ${n <= 1 ? 'outro' : 'outros'}`,
  agenda: 'Agenda',
  allDayRow: 'Dia inteiro e sem horário',
  timeGrid: 'Grade de horários',
  widgetEmpty: 'Nada planejado.',
  stageBody: (minutes: number, time: string) =>
    (minutes >= 1440
      ? minutes === 1440
        ? 'Amanhã'
        : `Em ${Math.round(minutes / 1440)} dias`
      : minutes >= 60
        ? `Em ${Math.round(minutes / 60)} h`
        : `Em ${minutes} min`) + ` · ${time}`,
  followUpTitle: (title: string) => `Ainda vale? ${title}`,
  untilNext: {
    empty: 'Não há mais nada planejado para hoje.',
    off: 'O tempo até o próximo evento está desligado.',
  },
  reminders: {
    title: 'Lembretes',
    add: 'Adicionar lembrete',
    edit: 'Editar lembrete',
    empty: 'Nenhum lembrete ainda.',
    next: 'Próximo',
    ended: 'Encerrado',
    paused: 'Pausado',
    active: 'Ativo',
    widgetEmpty: 'Nenhum lembrete pendente.',
  },
  notify: {
    label: 'Notificar',
    none: 'Não notificar',
    atStart: 'No início',
    minutes: (n: number) => (n <= 1 ? `${n} minuto antes` : `${n} minutos antes`),
    hour: '1 hora antes',
    day: '1 dia antes',
  },
  tabsLabel: 'Visão',
  tabCalendar: 'Calendário',
  tabReminders: 'Lembretes',
  kinds: {
    event: 'Evento',
    task: 'Tarefa',
    reminder: 'Lembrete',
    invoice: 'Fatura',
    subscription: 'Assinatura',
    cancel: 'Cancelamento',
    birthday: 'Aniversário',
    end: 'Fim do contrato',
    expiry: 'Vencimento',
    external: 'Externo',
  } as Record<string, string>,
  external: {
    title: 'Evento externo',
    readOnly: 'Este evento vem de um calendário externo. Altere-o lá; aqui ele é somente leitura.',
    open: 'Abrir no serviço de calendário',
    from: (source: string) => `Origem: ${source}`,
    sources: { google: 'Google Agenda', ics: 'Assinatura de calendário (ICS)' } as Record<
      string,
      string
    >,
    note: 'Nota',
  },
};
