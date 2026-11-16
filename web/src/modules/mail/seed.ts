import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

/**
 * Invented mails (account `demo`, shown only when no real mailbox is connected). Senders use
 * `example.org`; amounts and names are made up. Pure and deterministic: dates relative to `ctx.today`.
 */
interface Mock {
  from: { name: string; email: string };
  subject: string;
  text: string;
  html?: string;
  days: number;
  time: string;
  unread: boolean;
  labels: string[];
  /** The sender is a person (the filter „Persönlich“). */
  personal: boolean;
  /** The person's own answer as the newest message (labels `SENT`): the „Beantwortet?“ hint once it is planned. */
  reply?: { text: string; days: number; time: string };
}

const ME = { name: 'Test Person', email: 'test@example.org' };

const MAILS: Mock[] = [
  {
    from: { name: 'Stadtwerke Musterstadt', email: 'rechnung@stadtwerke.example.org' },
    subject: 'Ihre Rechnung für Oktober',
    text: 'Guten Tag,\n\nIhre Rechnung über 84,30 EUR ist fällig am 15.11. Bitte überweisen Sie den Betrag.\n\nIhre Stadtwerke',
    html: '<p>Guten Tag,</p><p>Ihre <b>Rechnung</b> über <b>84,30 EUR</b> ist fällig am 15.11.</p><img src="https://track.example.org/p.gif" width="1" height="1"><p>Ihre Stadtwerke</p>',
    days: 0,
    time: '08:15',
    unread: true,
    labels: ['INBOX', 'UNREAD', 'IMPORTANT'],
    personal: false,
  },
  {
    from: { name: 'Anna Beispiel', email: 'anna@example.org' },
    subject: 'Wochenende?',
    text: 'Hallo! Hast du am Samstag Zeit für einen Spaziergang? Liebe Grüße, Anna',
    days: 0,
    time: '07:40',
    unread: true,
    labels: ['INBOX', 'UNREAD'],
    personal: true,
  },
  {
    from: { name: 'Hausverwaltung Muster', email: 'info@hausverwaltung.example.org' },
    subject: 'Termin Ablesung Heizung',
    text: 'Die Ablesung findet am Donnerstag zwischen 9 und 12 Uhr statt. Bitte Zugang ermöglichen.',
    days: -1,
    time: '16:20',
    unread: false,
    labels: ['INBOX', 'IMPORTANT'],
    personal: true,
  },
  {
    from: { name: 'Beispiel-Shop', email: 'service@shop.example.org' },
    subject: 'Versandbestätigung zu Bestellung 12345',
    text: 'Ihre Bestellung wurde versendet. Die Sendungsnummer lautet 0000 1111 2222.',
    days: -2,
    time: '11:05',
    unread: false,
    labels: ['INBOX'],
    personal: false,
  },
  {
    from: { name: 'Internetanbieter Muster', email: 'kundenservice@provider.example.org' },
    subject: 'Rechnung 2026-1042',
    text: 'Anbei Ihre Rechnung über 39,99 EUR. Der Betrag wird am 03.11. abgebucht.',
    days: -4,
    time: '09:30',
    unread: false,
    labels: ['INBOX'],
    personal: false,
  },
  {
    from: { name: 'Stadtwerke Musterstadt', email: 'mahnung@stadtwerke.example.org' },
    subject: 'Zahlungserinnerung Kundennummer 4711',
    text: 'Zahlungserinnerung: Bitte zahlen Sie 92,40 EUR bis 20.11. Der Betrag enthält eine Mahngebühr.',
    days: -1,
    time: '10:10',
    unread: false,
    labels: ['INBOX'],
    personal: false,
  },
  {
    from: { name: 'Max Muster', email: 'max@example.org' },
    subject: 'Fotos vom Ausflug',
    text: 'Hier sind die Fotos vom Ausflug. Viel Spaß beim Anschauen!',
    days: -12,
    time: '19:45',
    unread: false,
    labels: ['INBOX'],
    personal: true,
  },
  {
    from: { name: 'Lisa Beispiel', email: 'lisa@example.org' },
    subject: 'Umzugshilfe am Sonntag?',
    text: 'Hi! Kannst du mir am Sonntag beim Umzug helfen? Ab 10 Uhr wäre super. Lisa',
    days: -1,
    time: '18:30',
    unread: false,
    labels: ['INBOX', 'SENT'],
    personal: true,
    reply: { text: 'Klar, ich bin um 10 Uhr da.', days: -1, time: '20:05' },
  },
  {
    // A letter as lawyers write it: „Kostennote“ and a span instead of „Rechnung“ and a date.
    from: { name: 'Kanzlei Beispiel & Partner', email: 'post@kanzlei.example.org' },
    subject: 'Ihr Zeichen AB-77 – Kostennote',
    text: 'Sehr geehrte Damen und Herren,\n\nin der Angelegenheit Beispiel Wohnbau GmbH übersenden wir unsere Kostennote. Bitte überweisen Sie den Gesamtbetrag von EUR 186,40 innerhalb von 14 Tagen.\n\nMit freundlichen Grüßen\nKanzlei Beispiel & Partner',
    days: -3,
    time: '14:20',
    unread: false,
    labels: ['INBOX'],
    personal: false,
  },
];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 4, medium: MAILS.length, large: MAILS.length });
  const rows = MAILS.slice(0, n);
  const thread = rows.map((m, i) => {
    const threadId = ctx.id('mail', 'thread', i);
    const newest = m.reply ?? m;
    return {
      id: `demo|${threadId}`,
      data: {
        accountKey: 'demo',
        threadId,
        sortKey: ctx.at(newest.days, newest.time),
        unread: m.unread,
        inbox: m.labels.includes('INBOX'),
        demo: {
          // As the provider lists it: the newest message's sender and preview.
          from: m.reply ? ME : m.from,
          subject: m.subject,
          snippet: newest.text.slice(0, 80).replace(/\s+/g, ' '),
          messageCount: m.reply ? 2 : 1,
          hasAttachment: false,
          labelIds: m.labels,
          personal: m.personal,
          lastMessageId: `${threadId}-m${m.reply ? 2 : 1}`,
          // What the list reads from the newest message's labels (`SENT`); a seed row stands for a fetched list.
          ...(m.reply ? { lastFromMe: true as const } : {}),
        },
      },
    };
  });
  const body = rows.flatMap((m, i) => {
    const threadId = ctx.id('mail', 'thread', i);
    const messageId = `${threadId}-m1`;
    const answer = m.reply
      ? [
          {
            id: `demo|${threadId}-m2`,
            data: {
              accountKey: 'demo',
              messageId: `${threadId}-m2`,
              threadId,
              sortKey: ctx.at(m.reply.days, m.reply.time),
              demo: {
                from: ME,
                to: [m.from],
                subject: `Re: ${m.subject}`,
                date: ctx.at(m.reply.days, m.reply.time),
                text: m.reply.text,
              },
            },
          },
        ]
      : [];
    return [
      {
        id: `demo|${messageId}`,
        data: {
          accountKey: 'demo',
          messageId,
          threadId,
          sortKey: ctx.at(m.days, m.time),
          demo: {
            from: m.from,
            to: [ME],
            subject: m.subject,
            date: ctx.at(m.days, m.time),
            text: m.text,
            html: m.html,
          },
        },
      },
      ...answer,
    ];
  });
  return { thread, body };
}

export default { seed } satisfies SeedModule;
