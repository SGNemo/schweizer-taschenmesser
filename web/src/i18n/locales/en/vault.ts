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
  allCategories: 'All categories',
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
  renew: 'Renewed',
  renewAria: (title: string) => `Renewed: ${title}`,
  renewDialog: {
    title: 'Renewed',
    until: (date: string) => `Until now: ${date}.`,
    newEnd: 'New end',
    proposed: (from: string) =>
      `Proposal: the same term once more, from ${from}. You can change the date.`,
    noStart: 'Without a start there is no proposal: please enter the new end.',
    notLater: 'The new end must be after the current one.',
    save: 'Save renewal',
  },
  views: { label: 'Views', documents: 'Filed', deadlines: 'Deadlines' },
  timeline: {
    label: 'Deadlines and expiry',
    today: 'Today',
    empty: 'No document has a date.',
    kinds: {
      cancel: 'Cancellation deadline',
      end: 'Expiry',
      expired: 'Expired',
      missed: 'Expiry · cancellation deadline passed',
    },
  },
  preview: {
    show: 'Show preview',
    hide: 'Hide preview',
    alt: (name: string) => `Preview: ${name}`,
    missing: 'The file is not on this device.',
  },
  renewed: (title: string, date: string) => `“${title}” now runs until ${date}.`,
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
  figureLabel: 'Filing',
  stateTabs: 'Views',
  labelCount: (label: string, n: number) => `${label} ${n}`,
  allStates: 'All',
  addFirst: 'Add your first document',
  detail: {
    label: 'Document',
    bare: 'No provider, date or file yet.',
  },
  stateGroups: {
    expired: 'Expired',
    due: 'Deadline ahead',
    ok: 'Fine',
  },
  privacyLine:
    'Files stay on this device and out of the backup · titles, deadlines and notes are synced',
  docCount: (n: number) => (n === 1 ? '1 document' : `${n} documents`),
  widgetRest: (due: number, total: number) =>
    [
      due > 0 ? `${due} with a deadline ahead` : '',
      total === 1 ? '1 document in total' : `${total} documents in total`,
    ]
      .filter(Boolean)
      .join(' · '),
  figureUnit: 'documents',
  figureDetail: (expired: number, due: number) =>
    [expired > 0 ? `${expired} expired` : '', due > 0 ? `${due} with a deadline ahead` : '']
      .filter(Boolean)
      .join(' · '),
  widgetSummary: (n: number) =>
    n === 1 ? '1 document needs a look' : `${n} documents need a look`,
};
