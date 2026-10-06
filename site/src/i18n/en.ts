// English page texts (second language). Same keys as de.ts.
export const en = {
  lang: 'en',
  htmlLang: 'en',
  siteName: 'Nemo',
  meta: {
    title: 'Nemo – the calm everyday app for PC and Android',
    description:
      'Calendar, tasks, finances and passwords in one app for Windows and Android. Your data stays with you: no account, no cloud. Open source, free.',
  },
  nav: { features: 'Features', install: 'Install', support: 'Support', github: 'GitHub' },
  theme: { toDark: 'Switch to dark theme', toLight: 'Switch to light theme' },
  langSwitch: { label: 'Language', de: 'Deutsch', en: 'English', short: { de: 'DE', en: 'EN' } },
  skip: 'Skip to content',
  hero: {
    title: 'A calm everyday app that keeps your data with you.',
    lead: 'Calendar, tasks, finances and passwords in one app for PC and Android. No account, no cloud.',
    windows: 'Download for Windows',
    windowsSub: 'Portable',
    android: 'Download for Android',
    androidSub: 'APK',
    facts: ['Open source', 'free', 'no cloud'],
    version: (v: string, d: string) => `Version ${v}, released ${d}`,
    fallbackVersion: 'Latest version',
    checksums: 'Show checksums (SHA-256)',
    checksumsHint: 'The checksum comes from the GitHub release. Compare it after downloading if you want to be sure.',
    allReleases: 'All versions and changes',
    screenshotAlt:
      'Nemo overview with made-up sample data: sidebar with modules, cards for today’s appointments, tasks, account balance and due invoices',
  },
  features: {
    eyebrow: 'What Nemo does',
    title: 'Everyday things, in one place.',
    items: [
      { icon: 'calendar', title: 'Calendar', text: 'Appointments, reminders and deadlines from other modules in one week view.' },
      { icon: 'tasks', title: 'Tasks', text: 'Lists, subtasks, repetition and a “someday”.' },
      { icon: 'wallet', title: 'Finances & subscriptions', text: 'Accounts, transactions, invoices and subscriptions, with bank statement import.' },
      { icon: 'bell', title: 'Reminders', text: 'Calm and bundled if you like, even when the app is closed.' },
      { icon: 'key', title: 'Password vault', text: 'Encrypted on the device, with TOTP and a generator. Invisible to AI.' },
      { icon: 'chat', title: 'Messages', text: 'A calm chat with a local model or a provider of your choice.' },
      { icon: 'drive', title: 'Clean up your PC', text: 'Analyse disk space and tidy up safely, always via the recycle bin first.' },
      { icon: 'sparkles', title: 'AI, only if you want it', text: 'Answers questions without sending your data. Works offline.' },
    ],
  },
  why: {
    eyebrow: 'Why Nemo',
    title: 'Made for days when everything calls at once.',
    items: [
      {
        title: 'Your data stays with you',
        text: 'Everything lives on your device. No account, no server of ours. Sync only if you run it yourself.',
      },
      {
        title: 'Calm and clear',
        text: 'One main action per view, little colour, no streaks and no pressure. Developed with ADHD in mind.',
      },
      {
        title: 'AI optional, offline too',
        text: 'The assistant never sees your entries, only your question. With a local model it works without internet.',
      },
    ],
  },
  install: {
    eyebrow: 'Install',
    title: 'Ready in a minute.',
    windows: {
      summary: 'Windows: one file, no installation',
      text: 'Run the file, done. The first time, SmartScreen asks: “More info” → “Run anyway”. The exe has no purchased certificate; updates are still signed and verified before they are applied. It needs WebView2, which Windows 10 and 11 usually have.',
    },
    android: {
      summary: 'Android: install the APK',
      text: 'Open the APK and allow “Install from this source” for your browser or file manager. Later updates are downloaded by the app itself and checksum-verified; Android only accepts APKs with the same signing key.',
    },
    updates: {
      summary: 'Updates arrive in the app',
      text: 'Settings → App updates. Before each update Nemo makes a backup and verifies the project’s signature. You decide when.',
    },
    dev: {
      summary: 'Dev preview (untested)',
      text: 'Every state of the development branch automatically produces a preview. It is a separate app “Nemo Dev” with its own data, untested and not meant for daily use. It does not replace the stable app.',
      windows: 'Dev preview for Windows',
      android: 'Dev preview for Android',
    },
    more: 'Full guide (German)',
  },
  support: {
    eyebrow: 'Support',
    title: 'Nemo stays free.',
    text: 'If you like, give something once via Ko-fi. As a thank-you you get a supporter code for a “thanks” badge and extra colour themes. Every feature stays open to everyone, without an account and without tracking.',
    button: 'Support on Ko-fi',
    note: 'Ko-fi is an external provider; payment happens only there.',
  },
  footer: {
    github: 'GitHub',
    releases: 'Releases',
    changelog: 'Changelog',
    roadmap: 'Roadmap',
    privacy: 'Privacy',
    imprint: 'Imprint',
    license: 'MIT licence',
  },
  legal: {
    imprintTitle: 'Imprint',
    privacyTitle: 'Privacy policy',
    back: 'Back to the start page',
  },
  notFound: { title: 'Page not found', text: 'This address does not exist.', back: 'Back to the start page' },
} as const;
