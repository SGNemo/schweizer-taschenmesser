import type { Strings } from '@/strings';

export const supporter: Strings['supporter'] = {
  tier: { kaffee: 'Coffee', kuchen: 'Cake', developer: 'Developer' },
  section: {
    title: 'Supporter',
    keywords: ['donate', 'support', 'coffee', 'thanks', 'code', 'Ko-fi', 'Spende'],
    intro:
      'Nemo is free and stays free: every feature is open to everyone. If you like the app, you can chip in voluntarily – any amount helps. As a small thank-you, there are purely cosmetic extras: a “Thanks” badge and extra colour themes.',
    donate: 'Support voluntarily',
    donateHint:
      'Opens the payment page in the browser. Payment happens only there; Nemo doesn’t process any payment data.',
    codeLabel: 'Supporter code',
    codeHint:
      'You get the code automatically by email after donating. Paste it here; it is only checked on this device.',
    codePlaceholder: 'NEMO1-…',
    paste: 'Paste',
    pasteFailed: 'Pasting didn’t work. Paste the code straight into the field.',
    save: 'Apply code',
    invalid: 'This code doesn’t match. Please check it was copied in full.',
    accepted: 'Thank you! The code has been applied.',
    statusTitle: 'Your status',
    tierLabel: 'Tier',
    nameLabel: 'Name',
    issuedLabel: 'Issued on',
    notSupporter: 'No code entered yet. That’s completely fine – you’re not missing anything.',
    remove: 'Remove code',
    removed: 'Code removed. You can enter it again any time.',
    unrecognised:
      'A saved code isn’t recognised by this app version. Update the app or enter the code again.',
    sidebarBadge: 'Thanks badge in the sidebar',
    sidebarBadgeHint: 'Subtly shows the tier below the logo.',
    noMail: 'Nothing arrived? Check your spam folder too.',
    resend: 'Resend code',
    contact: 'Get in touch',
    linkOpen: 'Open',
  },
  aboutRow: {
    label: 'Support Nemo',
    description: 'Voluntary, with cosmetic extras as a thank-you.',
    open: 'Learn more',
  },
  badge: {
    thanks: 'Thanks',
    thanksName: (name: string) => `Thanks, ${name}`,
  },
  palette: {
    label: 'Colour theme',
    hintSupporter: 'Purely visual; switch back to the default any time.',
    hintLocked:
      'Extra colour themes are a small thank-you for supporters. You can still try them: one click shows the theme for 30 seconds.',
    standard: 'Default',
    names: {
      korallenriff: 'Coral reef',
      tiefsee: 'Deep sea',
      sand: 'Sand',
      nordlicht: 'Northern lights',
      monochrom: 'Monochrome',
    },
    choose: (name: string) => `Choose colour theme ${name}`,
    tryOut: (name: string) => `Preview colour theme ${name} for 30 seconds`,
    locked: 'For supporters',
    previewing: (name: string) => `Preview: ${name}`,
    previewEnd: 'End preview',
    accentFollows: 'The colour theme sets the accent colour.',
  },
  logo: {
    label: 'Logo in theme colour',
    hint: 'The fish takes on the accent colour.',
    hintLocked: 'For supporters.',
  },
};
