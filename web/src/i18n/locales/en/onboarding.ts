import type { Strings } from '@/strings';

export const onboarding: Strings['onboarding'] = {
  button: 'Set up starter data',
  title: (module: string) => `Starter data: ${module}`,
  chooseIntro:
    'Where should the first entries come from? Nothing is saved until you confirm the preview.',
  skip: 'Skip',
  skipHint: 'You can reach the assistant again later in the module’s settings.',
  back: 'Back',
  preview: 'Show preview',
  parsing: 'Reading …',
  chooseFile: 'Choose file …',
  fileChosen: (name: string) => `File: ${name}`,
  textLabel: 'One line = one entry',
  pickTemplates: 'Choose suggestions',
  noInput: 'Please enter something.',
  nothingFound: 'No entries were recognised.',
  fileTooLarge: 'The file is too large (10 MB at most).',
  readError: 'The file couldn’t be read.',
  previewTitle: 'Preview',
  previewIntro: 'This is what would be saved. Untick any entries you don’t want.',
  found: (n: number) => (n === 1 ? '1 entry recognised' : `${n} entries recognised`),
  selectAll: 'Select all',
  selectNone: 'Select none',
  duplicate: 'Already there',
  change: 'Change',
  unchanged: 'No change',
  invalid: 'Can’t be imported',
  importN: (n: number) => (n === 1 ? 'Import 1 entry' : `Import ${n} entries`),
  importing: 'Saving …',
  imported: (n: number) => (n === 1 ? '1 entry was imported.' : `${n} entries were imported.`),
  undo: 'Undo import',
  undone: (removed: number, kept: number) =>
    kept > 0
      ? `${removed} ${removed === 1 ? 'entry' : 'entries'} removed. ${kept} ${kept === 1 ? 'was' : 'were'} edited in the meantime and ${kept === 1 ? 'is' : 'are'} kept.`
      : `${removed} ${removed === 1 ? 'entry' : 'entries'} removed.`,
  close: 'Close',
  recent: 'Recently imported',
  recentEntry: (source: string, n: number, date: string) =>
    `${source} · ${n} ${n === 1 ? 'entry' : 'entries'} · ${date}`,
  recentUndone: 'undone',
  errors: {
    'unknown-collection': 'This import doesn’t fit this module.',
    'nothing-selected': 'Nothing selected.',
    fallback: 'That didn’t work.',
  } as Record<string, string>,
  add: 'Add',
  required: 'Please fill in.',

  mail: {
    hint: 'Only with a connected Google account (Settings → Connections). Suggestions come from sender, subject, date and preview line; you confirm each one.',
    invoices: 'Find invoices in emails',
    subscriptions: 'Find subscriptions in emails',
    contracts: 'Find contracts in emails',
    calendar: 'Find events and tickets in emails',
    source: (url: string) => `Found in an email: ${url}`,
    dueUnclear: 'Due date not recognised – please check',
    startUnclear: 'Charge date estimated – please check',
    noAmount: (n: number) =>
      n === 1
        ? '1 invoice without a recognisable amount was skipped.'
        : `${n} invoices without a recognisable amount were skipped.`,
    noEnd: 'Contract end not recognised',
    notice: (days: number) => `Notice period ${days} ${days === 1 ? 'day' : 'days'}`,
  },
  ics: {
    exdate: (n: number) =>
      `${n} recurring ${n === 1 ? 'event had' : 'events had'} exception dates (single skipped days); these exceptions are not carried over.`,
    rruleUnsupported: (n: number) =>
      `${n} ${n === 1 ? 'event has' : 'events have'} a repeat rule this app doesn’t know; ${n === 1 ? 'it is' : 'they are'} imported as a single event.`,
    override: (n: number) =>
      `${n} changed single ${n === 1 ? 'occurrence' : 'occurrences'} of a series ${n === 1 ? 'was' : 'were'} skipped.`,
    cancelled: (n: number) => `${n} cancelled ${n === 1 ? 'event was' : 'events were'} skipped.`,
    invalid: (n: number) =>
      `${n} ${n === 1 ? 'event' : 'events'} without a valid date ${n === 1 ? 'was' : 'were'} skipped.`,
  },
  lines: (skipped: number) =>
    skipped === 1 ? '1 line wasn’t recognised.' : `${skipped} lines weren’t recognised.`,
  calendar: {
    ics: 'Calendar file (.ics)',
    icsHint:
      'Export your calendar (e.g. Google Calendar, Outlook, Thunderbird) as an .ics file and choose it here.',
  },
  todos: {
    text: 'Paste tasks',
    textHint: 'Paste a list from a notes app or a message: one line per task.',
    placeholder: 'Sort tax papers\nCall the dentist\nFix the bike',
    list: 'Into this list',
  },
  reminders: {
    textDetail: 'today, 09:00',
    templates: 'Templates for common reminders',
    templatesHint:
      'Choose what the app should remind you about. You can change times and days afterwards.',
    text: 'Paste reminders',
    textHint: 'One line per reminder; it starts today at 09:00 and can be adjusted afterwards.',
    placeholder: 'Change tyres\nGet a present for Mum',
    rent: ['Pay the rent', 'every month on the 1st'],
    trash: ['Put the bins out', 'every week, Sunday 19:00 – adjust the weekday afterwards'],
    insurance: [
      'Compare car insurance',
      'every year on 1 November (switching deadline usually 30 Nov)',
    ],
    energy: ['Check electricity and gas contract', 'every year on 1 September'],
    tax: ['Gather tax papers', 'every year on 1 June'],
    dentist: ['Book a dental check-up', 'every 6 months'],
    smoke: ['Test smoke alarms', 'every year on 1 January'],
    statements: ['Check bank statements', 'every month on the 1st'],
  },
  finance: {
    account: 'Add account with opening balance',
    accountHint: 'For another account. You change the existing account under Finances → Accounts.',
    name: 'Account name',
    balance: 'Balance today',
    balanceHint: (sample: string) => `e.g. ${sample} – with “-” for a negative amount.`,
    badBalance: (sample: string) => `Please enter an amount like ${sample}.`,
    bank: 'Import bank statement (CSV or CAMT)',
    bankHint:
      'In online banking, export your transactions (e.g. “CSV-CAMT” or “CAMT”) and choose the file here. The file is only read on this device.',
    bankAccount: 'Book to account',
    noAccounts: 'Add an account first.',
    bankFormat:
      'The file format wasn’t recognised. Expected is a CSV file with booking date and amount, or a CAMT file (XML).',
    bankSkipped: (n: number) =>
      n === 1
        ? '1 line without a valid date or amount was skipped.'
        : `${n} lines without a valid date or amount were skipped.`,
    bankTruncated: (n: number) => `Only the first ${n} transactions are shown.`,
  },
  invoices: {
    form: 'Add an open invoice',
    payee: 'Issued by',
    amount: 'Amount',
    due: 'Due on',
    reference: 'Reference (optional)',
    badAmount: (sample: string) => `Please enter an amount like ${sample}.`,
    badDate: 'Please enter a date like 15.03.2026.',
  },
  subscriptions: {
    form: 'Add a subscription',
    name: 'Name',
    amount: 'Price per charge',
    rhythm: 'Interval',
    monthly: 'monthly',
    quarterly: 'quarterly',
    yearly: 'yearly',
    next: 'Next charge on',
    notice: 'Notice period in days (optional)',
    badAmount: (sample: string) => `Please enter an amount like ${sample}.`,
    badDate: 'Please enter a date like 15.03.2026.',
    badNotice: 'Please enter a whole number.',
    bank: 'Find subscriptions in a bank statement',
    bankHint:
      'Choose a bank statement (CSV or CAMT, ideally a year). The app looks for regular charges with the same amount and suggests them as subscriptions. The file is only read on this device.',
    bankFormat:
      'The file format wasn’t recognised. Expected is a CSV file with booking date and amount, or a CAMT file (XML).',
    bankNone:
      'No regular charges were found. Recognition needs at least three equal charges at similar intervals.',
    seen: (n: number, last: string) => `${n} ${n === 1 ? 'charge' : 'charges'}, last on ${last}`,
  },
  bookmarks: {
    html: 'Browser bookmarks (HTML)',
    htmlHint:
      'Export your browser’s bookmarks as an HTML file (Chrome/Edge: Bookmark manager → ⋮ → Export bookmarks). Folder names become tags.',
    text: 'Paste links',
    textHint: 'One line per link, optionally with a title in front.',
    placeholder: 'https://example.org/article\nLovely hike https://example.org/hiking',
  },
  birthdays: {
    text: 'Paste birthdays',
    textHint: 'One line per person: name and date, with or without the year.',
    placeholder: 'Anna Example 15.03.1985\nUncle Max 02.11.\n24.12. Grandma',
  },
  lists: {
    text: 'Paste shopping list',
    textHint: 'One line per item; amounts like “2 milk” are recognised.',
    placeholder: '2 milk\nBread\n500 g flour',
    templates: 'Packing list templates',
    templatesHint: 'Ready-made lists for typical trips; you can change them afterwards.',
    packingKind: 'Packing list',
    weekend: {
      name: 'Weekend trip',
      note: 'Two nights, train and hand luggage',
      items: [
        'Toothbrush',
        'Charging cable',
        'Rain jacket',
        'Change of clothes',
        'Train ticket',
        'Headphones',
        'Sunglasses',
        'Book',
      ],
    },
    camping: {
      name: 'Camping',
      note: 'Three days by the lake',
      items: [
        'Tent',
        'Sleeping bag',
        'Sleeping mat',
        'Camping stove',
        'Head torch',
        'Insect repellent',
        'Water container',
        'Pocket knife',
        'Bin bags',
        'Sun cream',
      ],
    },
    beach: {
      name: 'Beach holiday',
      note: '',
      items: [
        'Swimwear',
        'Beach towel',
        'Flip-flops',
        'Sun hat',
        'Passport',
        'Travel first-aid kit',
      ],
    },
    ski: {
      name: 'Ski weekend',
      note: '',
      items: ['Ski jacket', 'Gloves', 'Ski goggles', 'Thermal underwear', 'Ski pass', 'Lip balm'],
    },
  },
};
