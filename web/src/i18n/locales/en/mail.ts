import type { Strings } from '@/strings';

export const mail: Strings['mail'] = {
  meta: {
    name: 'Mail',
    description:
      'Inbox, search and reading mail – read-only, no cloud AI. Uses your Google account from Connections.',
    quickAdd: 'Mail: open inbox',
    images: 'Images in mail',
    imagesHelp:
      'External images tell the sender you opened the mail. Default: load only after a click.',
    imagesAsk: 'Load after a click',
    imagesAlways: 'Always load',
    cacheBodies: 'Keep opened mails in the cache',
    cacheBodiesHelp:
      'Encrypted on this device, not synced and not in backups. Without it every mail is fetched again when opened.',
  },
  page: {
    refresh: 'Refresh',
    loading: 'Loading mail …',
    more: 'Load more',
    searchLabel: 'Search',
    searchPlaceholder: 'Search, e.g. from:name has:attachment',
    searchHint:
      'Gmail search syntax applies: from:, to:, subject:, has:attachment, newer_than:7d, label:…',
    searchEnd: 'End search',
    account: 'Account',
    accountN: (n: number) => `Account ${n}`,
    label: 'Folder',
    empty: 'No mail in this view.',
    emptySearch: 'Nothing found.',
    settings: 'Mail settings',
    unread: (n: number) => `${n} unread`,
    messages: (n: number) => (n === 1 ? '1 message' : `${n} messages`),
    demo: 'Sample mail (test data). Connect Gmail to see your own.',
    cached: 'No connection: showing the last saved state.',
    groups: { today: 'Today', yesterday: 'Yesterday', week: 'This week', older: 'Older' },
    noSubject: '(no subject)',
    labels: {
      INBOX: 'Inbox',
      STARRED: 'Starred',
      IMPORTANT: 'Important',
      SENT: 'Sent',
      DRAFT: 'Drafts',
      TRASH: 'Trash',
      SPAM: 'Spam',
    },
  },
  connect: {
    title: 'No mail account connected yet',
    body: 'Connect your Google account in Settings and switch on “Mail”. Nemo only reads: nothing is sent, deleted or moved.',
    action: 'Go to Connections',
  },
  errors: {
    expired: 'The Google sign-in has expired.',
    denied: 'Permission is missing for this. Switch on “Mail” in Connections and sign in again.',
    'rate-limited': 'Google is slowing requests down. Please try again in a few minutes.',
    network: 'No connection to the mail service.',
    generic: 'The mail could not be loaded.',
    action: 'Go to Connections',
  },
  view: {
    back: 'Back to list',
    from: 'From',
    to: 'To',
    cc: 'Cc',
    attachments: 'Attachments',
    download: (name: string) => `Download ${name}`,
    saved: 'Attachment saved.',
    downloadLabel: 'Download',
    downloadFailed: 'The attachment could not be loaded.',
    blockedImages: (n: number) =>
      n === 1 ? '1 external image blocked' : `${n} external images blocked`,
    loadImages: 'Load images',
    loadingImages: 'Loading images …',
    trackers: (n: number) =>
      n === 1 ? '1 tracking pixel removed' : `${n} tracking pixels removed`,
    noBody: '(no text)',
    frameTitle: (subject: string) => `Mail content: ${subject}`,
    readOnly: 'Nemo only reads: this does not change the unread status.',
    openInGmail: 'Open in Gmail',
    expand: (who: string) => `Expand message from ${who}`,
    loadFailed: 'The mail could not be loaded.',
  },
  panel: {
    title: 'Mail settings',
    accounts: 'Accounts',
    noAccounts: 'No account connected.',
    accountsHint: 'Accounts are signed in and removed under Connections.',
    manage: 'Open Connections',
    scopes: 'Permission',
    scopesBody:
      'Reading uses the Google permission “Read Gmail” (gmail.readonly). Write permissions such as archiving or replying do not exist yet; they would be switched on one by one, with an explanation.',
    cache: 'Cache',
    cacheBody: (threads: number, bodies: number) =>
      `${threads} mail headers and ${bodies} opened mails, encrypted on this device. Not synced, not in backups.`,
    clear: 'Clear cache',
    cleared: 'Cache cleared.',
    clearTitle: 'Clear the cache?',
    clearBody: 'The mail stays at Google. It is fetched again the next time you open it.',
    notifications: 'Notifications',
    notificationsBody: 'Not available yet: the app does not announce new mail on its own.',
    close: 'Close',
  },
  widget: {
    unread: 'Unread',
    unreadContext: (n: number) =>
      n === 0
        ? 'Inbox is empty'
        : n === 1
          ? 'Unread thread in the inbox'
          : 'Unread threads in the inbox',
    important: 'Top mail',
    importantSummary: (n: number) => `${n} unread`,
    invoices: 'Invoice mails',
    invoicesContext: (days: number) => `in the last ${days} days`,
    empty: 'No mail yet.',
    emptyAction: 'Open mail',
    link: 'Open mail',
  },
};
