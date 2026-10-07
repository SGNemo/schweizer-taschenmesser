import type { Strings } from '@/strings';

export const vault: Strings['vault'] = {
  meta: {
    name: 'Documentos',
    description:
      'Documentos de identidade, contratos, seguros e garantias com término, prazo de cancelamento e arquivo anexo – no calendário e com lembrete antes que um prazo vença. Os arquivos ficam só neste dispositivo.',
    route: 'Documentos',
    widget: 'Prazos e vencimentos',
    quickAdd: 'Documento',
    settings: {
      remindDaysBefore: 'Lembrete antes do vencimento (dias)',
      remindDaysBeforeDeadline: 'Lembrete antes do prazo de cancelamento (dias)',
      remindTime: 'Horário do lembrete',
      remindTimeHelp: 'Formato HH:mm',
    },
  },
  title: 'Documentos',
  add: 'Adicionar documento',
  edit: 'Editar documento',
  category: 'Categoria',
  allCategories: 'Todos',
  categories: {
    identity: 'Identidade',
    insurance: 'Seguro',
    contract: 'Contratos',
    warranty: 'Garantias',
    tax: 'Impostos',
    health: 'Saúde',
    other: 'Outros',
  } as Record<string, string>,
  provider: 'Fornecedor',
  startDate: 'Início',
  endDate: 'Término / vencimento',
  noticeDays: 'Prazo de cancelamento (dias antes do término)',
  noticeHint: 'Deixe vazio se não houver prazo (por exemplo, em documentos ou garantias).',
  invalid: 'Confira os dados (o término não pode ser antes do início).',
  endLabel: 'Término',
  deadlineLabel: 'Cancelar até',
  endsOn: (title: string, category: string) =>
    category === 'warranty'
      ? `Garantia termina: ${title}`
      : category === 'contract' || category === 'insurance'
        ? `Fim do contrato: ${title}`
        : `Vence: ${title}`,
  cancelBy: (title: string) => `Prazo de cancelamento: ${title}`,
  remindBody: (date: string) => `Em ${date.split('-').reverse().join('/')}`,
  file: 'Arquivo',
  localOnly:
    'Os arquivos ficam só neste dispositivo: não são sincronizados nem incluídos no backup. Título, data de vencimento e notas são sincronizados normalmente.',
  fileElsewhere: 'Arquivo só em outro dispositivo',
  removeFile: 'Remover arquivo',
  tooLarge: (max: string) => `O arquivo é grande demais (no máximo ${max}).`,
  download: 'Baixar',
  search: 'Buscar documentos',
  status: {
    expired: 'Vencido',
    'act-now': 'Cancelar agora',
    soon: 'Em breve',
    ok: '',
    'open-ended': '',
  } as Record<string, string>,
  empty: 'Ainda não há documentos.',
  emptyFiltered: 'Nada encontrado.',
  widgetEmpty: 'Nenhum prazo à vista.',
};
