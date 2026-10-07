import type { Strings } from '@/strings';

export const vault: Strings['vault'] = {
  meta: {
    name: 'Documents',
    description:
      'IDs, contracts, insurance and warranties with end date, notice period and an attached file – in the calendar and with a reminder before a deadline passes. Files stay on this device only.',
    route: 'Documents',
    widget: 'Deadlines & expiry',
    quickAdd: 'Document',
    settings: {
      remindDaysBefore: 'Reminder before expiry (days)',
      remindDaysBeforeDeadline: 'Reminder before the notice period (days)',
      remindTime: 'Reminder time',
      remindTimeHelp: 'Format HH:mm',
    },
  },
  title: 'Documents',
  add: 'Add document',
  edit: 'Edit document',
  category: 'Category',
  allCategories: 'All',
  categories: {
    identity: 'IDs',
    insurance: 'Insurance',
    contract: 'Contracts',
    warranty: 'Warranties',
    tax: 'Tax',
    health: 'Health',
    other: 'Other',
  } as Record<string, string>,
  provider: 'Provider',
  startDate: 'Start',
  endDate: 'End / expiry',
  noticeDays: 'Notice period (days before the end)',
  noticeHint: 'Leave empty if there is no deadline (e.g. for IDs or warranties).',
  invalid: 'Please check the details (the end can’t be before the start).',
  endLabel: 'End',
  deadlineLabel: 'Cancel by',
  endsOn: (title: string, category: string) =>
    category === 'warranty'
      ? `Warranty ends: ${title}`
      : category === 'contract' || category === 'insurance'
        ? `Contract ends: ${title}`
        : `Expires: ${title}`,
  cancelBy: (title: string) => `Notice period: ${title}`,
  remindBody: (date: string) => `On ${date.split('-').reverse().join('.')}`,
  file: 'File',
  localOnly:
    'Files stay on this device only: they are neither synced nor written to the backup. Title, expiry date and notes are synced as usual.',
  fileElsewhere: 'File only on another device',
  removeFile: 'Remove file',
  tooLarge: (max: string) => `The file is too large (at most ${max}).`,
  download: 'Download',
  search: 'Search documents',
  status: {
    expired: 'Expired',
    'act-now': 'Cancel now',
    soon: 'Soon',
    ok: '',
    'open-ended': '',
  } as Record<string, string>,
  empty: 'No documents yet.',
  emptyFiltered: 'Nothing found.',
  widgetEmpty: 'No deadlines in sight.',
};
