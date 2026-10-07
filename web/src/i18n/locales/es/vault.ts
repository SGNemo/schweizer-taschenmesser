import type { Strings } from '@/strings';

export const vault: Strings['vault'] = {
  meta: {
    name: 'Documentos',
    description:
      'Documentos de identidad, contratos, seguros y garantías con fecha de fin, plazo de cancelación y archivo adjunto, en el calendario y con recordatorio antes de que venza un plazo. Los archivos se quedan solo en este dispositivo.',
    route: 'Documentos',
    widget: 'Plazos y vencimientos',
    quickAdd: 'Documento',
    settings: {
      remindDaysBefore: 'Recordatorio antes del vencimiento (días)',
      remindDaysBeforeDeadline: 'Recordatorio antes del plazo de cancelación (días)',
      remindTime: 'Hora del recordatorio',
      remindTimeHelp: 'Formato HH:mm',
    },
  },
  title: 'Documentos',
  add: 'Añadir documento',
  edit: 'Editar documento',
  category: 'Categoría',
  allCategories: 'Todas',
  categories: {
    identity: 'Identificación',
    insurance: 'Seguros',
    contract: 'Contratos',
    warranty: 'Garantías',
    tax: 'Impuestos',
    health: 'Salud',
    other: 'Otros',
  } as Record<string, string>,
  provider: 'Proveedor',
  startDate: 'Inicio',
  endDate: 'Fin / vencimiento',
  noticeDays: 'Plazo de cancelación (días antes del fin)',
  noticeHint: 'Déjalo vacío si no hay plazo (p. ej. en documentos de identidad o garantías).',
  invalid: 'Revisa los datos (el fin no puede ser anterior al inicio).',
  endLabel: 'Fin',
  deadlineLabel: 'Cancelar antes del',
  endsOn: (title: string, category: string) =>
    category === 'warranty'
      ? `Termina la garantía: ${title}`
      : category === 'contract' || category === 'insurance'
        ? `Fin del contrato: ${title}`
        : `Caduca: ${title}`,
  cancelBy: (title: string) => `Plazo de cancelación: ${title}`,
  remindBody: (date: string) => `El ${date.split('-').reverse().join('/')}`,
  file: 'Archivo',
  localOnly:
    'Los archivos se quedan solo en este dispositivo: no se sincronizan ni se incluyen en la copia de seguridad. El título, la fecha de vencimiento y las notas se sincronizan como siempre.',
  fileElsewhere: 'Archivo solo en otro dispositivo',
  removeFile: 'Quitar archivo',
  tooLarge: (max: string) => `El archivo es demasiado grande (como máximo ${max}).`,
  download: 'Descargar',
  search: 'Buscar en documentos',
  status: {
    expired: 'Caducado',
    'act-now': 'Cancelar ya',
    soon: 'Pronto',
    ok: '',
    'open-ended': '',
  } as Record<string, string>,
  empty: 'Aún no hay documentos.',
  emptyFiltered: 'No se encontró nada.',
  widgetEmpty: 'No hay plazos a la vista.',
};
