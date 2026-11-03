import type { Strings } from '@/strings';

export const habits: Strings['habits'] = {
  meta: {
    name: 'Hábitos',
    description:
      'Metas diárias e semanais com anéis: um visto ou um número como “8 copos”, com dias de descanso, histórico e lembretes que param quando a meta do dia é atingida.',
    quickAdd: 'Hábito',
    widget: 'Hoje',
    settings: {
      remindersEnabled: 'Lembretes dos hábitos',
      remindersHelp: 'Desligado: nenhum lembrete chega, os anéis continuam.',
    },
  },
  title: 'Hábitos',
  tabs: { label: 'Visão', today: 'Hoje', history: 'Histórico', archive: 'Arquivo' },
  empty: 'Ainda não há hábitos.',
  emptyHint:
    'Comece pequeno: por exemplo “Beber água” com um número e um lembrete numa faixa de horário.',
  add: 'Adicionar hábito',
  edit: 'Editar hábito',
  form: {
    name: 'Nome',
    kind: 'Tipo',
    yesno: 'Sim/Não',
    count: 'Número',
    target: 'Meta por dia',
    unit: 'Unidade (ex.: copos)',
    period: 'Ritmo',
    day: 'Todos os dias',
    week: 'Várias vezes por semana',
    weeklyTimes: 'Vezes por semana',
    weekdays: 'Dias da semana',
    weekdaysHint: 'Sem seleção = todos os dias.',
    reminder: 'Lembrete',
    reminderOff: 'Desligado',
    reminderTime: 'Num horário',
    reminderWindow: 'Numa faixa de horário',
    at: 'Horário',
    from: 'De',
    to: 'Até',
    every: 'A cada (minutos)',
    reminderHint:
      'Numa faixa de horário, o app lembra até a meta do dia ser atingida – depois não mais.',
    templates: 'Modelos',
  },
  templates: {
    water: { name: 'Beber água', unit: 'copos' },
    walk: { name: 'Dar uma caminhada', unit: '' },
    stretch: { name: 'Alongar', unit: '' },
    pill: { name: 'Tomar o remédio', unit: '' },
  },
  today: {
    progress: (n: number, target: number, unit?: string) =>
      `${n} de ${target}${unit ? ` ${unit}` : ''}`,
    done: 'Feito',
    plus: '+1',
    minus: '−1',
    markDone: 'Feito',
    undo: 'Desfazer',
    rest: 'Dia de descanso',
    restOn: 'Dia de descanso: hoje não conta.',
    restOff: 'Remover dia de descanso',
    weekProgress: (done: number, of: number) => `${done} de ${of} nesta semana`,
    plusFor: (name: string) => `+1 ${name}`,
    minusFor: (name: string) => `−1 ${name}`,
    nothing: 'Nada planejado para hoje.',
  },
  history: {
    pick: 'Hábito',
    last30: 'Últimos 30 dias',
    ofDays: (done: number, of: number) => `${done} de ${of} dias planejados`,
    ofWeeks: (done: number, of: number) => `${done} de ${of} semanas cumpridas`,
    perWeekday: 'Por dia da semana',
    best: (n: number) => `Maior sequência: ${n}`,
    grid: 'O último ano, uma coluna por semana',
    legend: {
      done: 'Feito',
      partial: 'Em parte',
      open: 'Em aberto',
      rest: 'Dia de descanso',
      off: 'Não planejado',
    },
    noData: 'Ainda nada conta neste período.',
    cell: (date: string, state: string, count: number) =>
      `${date}: ${state}${count > 0 ? `, ${count}` : ''}`,
  },
  archive: {
    empty: 'Nada arquivado.',
    archived: 'Arquivado.',
    restored: 'Ativo de novo.',
    archiveAction: 'Arquivar',
    restoreAction: 'Restaurar',
  },
  notify: {
    body: (n: number, target: number, unit?: string) =>
      `${n} de ${target}${unit ? ` ${unit}` : ''}`,
  },
  widget: {
    summary: (done: number, of: number) => `${done} de ${of} feitos`,
    detail: (n: number, target: number, unit?: string) =>
      `${n} de ${target}${unit ? ` ${unit}` : ''}`,
    plusFor: (name: string) => `+1 ${name}`,
    empty: 'Ainda não há hábitos.',
    addAction: 'Criar um hábito',
  },
  head: {
    label: 'Hoje',
    value: (done: number, of: number) => `${done}/${of}`,
    none: 'Nada planejado',
  },
};
