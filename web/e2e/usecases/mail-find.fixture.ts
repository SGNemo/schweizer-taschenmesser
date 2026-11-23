/**
 * The invented mailbox of the use case „Mail finden“ (docs/design/mail-find/ANALYSIS.md): about 300 mails from
 * made-up senders on `example.org`, made-up amounts, deterministic. Written as demo rows of the mail cache
 * (account `demo`, fields in the clear), so the measurement needs no Google login and nothing leaves the machine.
 *
 * The five targets of the measurement are marked by thread id (`TARGETS`).
 */

export const TODAY = '2026-11-23'; // Monday
const ME = { name: 'Test Person', email: 'test@example.org' };

export interface FixtureMail {
  id: string;
  from: { name: string; email: string };
  subject: string;
  snippet: string;
  text: string;
  /** Days before TODAY (0 = today). */
  daysAgo: number;
  time: string;
  unread: boolean;
  labels: string[];
  personal: boolean;
  messageCount: number;
  attachments: string[];
  /** The newest message is the person's own reply. */
  lastFromMe?: boolean;
}

/** Thread ids the five tasks look for. */
export const TARGETS = {
  springInvoice: 't-invoice-spring',
  sender: [] as string[],
  attachment: 't-attachment-lease',
  waiting: [] as string[],
  weekImportant: [] as string[],
};

/** A tiny deterministic generator (no Math.random: the numbers must not move between runs). */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const euro = (cents: number) =>
  `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')} EUR`;

export function buildMailbox(): FixtureMail[] {
  const r = rng(7);
  TARGETS.sender.length = 0;
  TARGETS.waiting.length = 0;
  TARGETS.weekImportant.length = 0;
  const out: FixtureMail[] = [];
  let n = 0;
  const add = (
    m: Omit<FixtureMail, 'id' | 'messageCount' | 'attachments' | 'time'> & Partial<FixtureMail>,
  ) =>
    out.push({
      id: m.id ?? `t-${String(++n).padStart(3, '0')}`,
      messageCount: 1,
      attachments: [],
      time: `${String(7 + Math.floor(r() * 12)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`,
      ...m,
    });

  // Invoices: 6 invented billers, roughly monthly over a year (≈ 45 mails), PDFs attached.
  const billers = [
    ['Stadtwerke Musterstadt', 'rechnung@stadtwerke.example.org', 'Strom'],
    ['Wasserwerk Musterstadt', 'service@wasserwerk.example.org', 'Wasser'],
    ['Internetanbieter Muster', 'kundenservice@provider.example.org', 'Internet'],
    ['Mobilfunk Beispiel', 'rechnung@mobil.example.org', 'Mobilfunk'],
    ['Versicherung Muster AG', 'post@versicherung.example.org', 'Hausrat'],
    ['Musterbank', 'konto@bank.example.org', 'Kontoführung'],
  ] as const;
  for (const [i, [name, email, what]] of billers.entries()) {
    for (let k = 0; k < 8; k++) {
      const daysAgo = 3 + i * 2 + k * 42;
      if (daysAgo > 360) break;
      const cents = 1500 + Math.floor(r() * 12000);
      add({
        from: { name, email },
        subject: `Ihre Rechnung ${what}`,
        snippet: `Ihre Rechnung über ${euro(cents)} ist fällig.`,
        text: `Guten Tag,\n\nanbei Ihre Rechnung ${what} über ${euro(cents)}. Der Betrag wird abgebucht.\n\n${name}`,
        daysAgo,
        unread: false,
        labels: ['INBOX'],
        personal: false,
        attachments: [`Rechnung_${what}_${k + 1}.pdf`],
      });
    }
  }
  // The spring invoice the first task looks for: water, first quarter, mid-April.
  add({
    id: TARGETS.springInvoice,
    from: { name: 'Wasserwerk Musterstadt', email: 'service@wasserwerk.example.org' },
    subject: 'Ihre Rechnung Wasser 1. Quartal',
    snippet: 'Ihre Rechnung über 61,20 EUR für Januar bis März ist fällig am 30.04.',
    text: 'Guten Tag,\n\nanbei Ihre Rechnung Wasser für das 1. Quartal über 61,20 EUR, fällig am 30.04.\n\nWasserwerk Musterstadt',
    daysAgo: 223, // 2026-04-14
    unread: false,
    labels: ['INBOX'],
    personal: false,
    attachments: ['Rechnung_Wasser_Q1.pdf'],
  });

  // Newsletters: 8 senders, ≈ 120 mails, never personal.
  const letters = [
    ['Beispiel-Shop', 'news@shop.example.org', 'Neue Angebote der Woche'],
    ['Reiseportal Muster', 'deals@reise.example.org', 'Ihre Reiseideen'],
    ['Buchclub Beispiel', 'post@buchclub.example.org', 'Lesetipps'],
    ['Sportverein Muster', 'info@sportverein.example.org', 'Vereinsnachrichten'],
    ['Möbelhaus Beispiel', 'newsletter@moebel.example.org', 'Wohnideen'],
    ['Kochportal Muster', 'rezepte@kochen.example.org', 'Rezepte der Woche'],
    ['Technikmarkt Beispiel', 'angebote@technik.example.org', 'Nur heute'],
    ['Zeitung Musterstadt', 'abo@zeitung.example.org', 'Ihr Morgenbrief'],
  ] as const;
  for (let k = 0; k < 120; k++) {
    const [name, email, topic] = letters[k % letters.length]!;
    add({
      from: { name, email },
      subject: `${topic} – Ausgabe ${Math.floor(k / letters.length) + 1}`,
      snippet: 'Entdecken Sie unsere Auswahl. Zum Abbestellen klicken Sie hier.',
      text: 'Entdecken Sie unsere Auswahl.\n\nZum Abbestellen klicken Sie hier.',
      daysAgo: Math.floor(k * 2.6),
      unread: k % 3 === 0,
      labels: ['INBOX', 'CATEGORY_PROMOTIONS', ...(k % 3 === 0 ? ['UNREAD'] : [])],
      personal: false,
    });
  }

  // Authorities: 14 mails.
  const offices = [
    ['Finanzamt Musterstadt', 'post@finanzamt.example.org', 'Ihre Steuererklärung'],
    ['Bürgeramt Musterstadt', 'termine@buergeramt.example.org', 'Terminbestätigung'],
    ['Familienkasse Muster', 'post@familienkasse.example.org', 'Bescheid'],
  ] as const;
  for (let k = 0; k < 14; k++) {
    const [name, email, subject] = offices[k % offices.length]!;
    add({
      from: { name, email },
      subject: `${subject} (Az. ${1000 + k})`,
      snippet: 'Bitte beachten Sie die Fristen im beigefügten Schreiben.',
      text: 'Sehr geehrte Damen und Herren,\n\nbitte beachten Sie die Fristen im beigefügten Schreiben.',
      daysAgo: 5 + k * 23,
      unread: false,
      labels: ['INBOX', 'IMPORTANT'],
      personal: false,
      attachments: [`Schreiben_${1000 + k}.pdf`],
    });
  }

  // The sender of the second task: the kindergarten, 9 mails over half a year.
  for (let k = 0; k < 9; k++) {
    const id = `t-sender-${k}`;
    TARGETS.sender.push(id);
    add({
      id,
      from: { name: 'Kita Pusteblume', email: 'leitung@kita-pusteblume.example.org' },
      subject: ['Elternabend', 'Schließtage', 'Ausflug', 'Fotograf', 'Sommerfest'][k % 5]!,
      snippet: 'Liebe Eltern, hier die Informationen für die nächsten Wochen.',
      text: 'Liebe Eltern,\n\nhier die Informationen für die nächsten Wochen.\n\nIhre Kita',
      daysAgo: 1 + k * 19,
      unread: k === 0,
      labels: ['INBOX', ...(k === 0 ? ['UNREAD'] : [])],
      personal: true,
    });
  }

  // The attachment of the third task: the subject does not name it.
  add({
    id: TARGETS.attachment,
    from: { name: 'Hausverwaltung Muster', email: 'info@hausverwaltung.example.org' },
    subject: 'Unterlagen wie besprochen',
    snippet: 'Guten Tag, anbei die Unterlagen wie am Telefon besprochen.',
    text: 'Guten Tag,\n\nanbei die Unterlagen wie am Telefon besprochen.\n\nHausverwaltung Muster',
    daysAgo: 61,
    unread: false,
    labels: ['INBOX'],
    personal: true,
    attachments: ['Mietvertrag_Nachtrag_2026.pdf'],
  });

  // Work: 55 mails, some threads, a few with questions; most are answered already.
  const colleagues = [
    ['Jana Beispiel', 'jana@firma.example.org'],
    ['Malte Muster', 'malte@firma.example.org'],
    ['Projektteam Muster', 'team@firma.example.org'],
    ['Sekretariat Beispiel', 'sekretariat@firma.example.org'],
  ] as const;
  const topics = ['Protokoll', 'Planung Quartal', 'Kurze Frage', 'Termin nächste Woche', 'Entwurf'];
  for (let k = 0; k < 55; k++) {
    const [name, email] = colleagues[k % colleagues.length]!;
    const answered = k % 4 !== 1;
    add({
      from: { name, email },
      subject: `${topics[k % topics.length]} ${k + 1}`,
      snippet: answered ? 'Danke, passt so.' : 'Kannst du bitte bis Freitag drüberschauen?',
      text: answered
        ? 'Danke, passt so.'
        : 'Hallo,\n\nkannst du bitte bis Freitag drüberschauen?\n\nGruß',
      daysAgo: Math.floor(k * 1.7),
      unread: !answered && k < 12,
      labels: ['INBOX', ...(!answered && k < 12 ? ['UNREAD'] : []), ...(answered ? ['SENT'] : [])],
      personal: true,
      messageCount: answered ? 2 + (k % 3) : 1,
      lastFromMe: answered,
    });
  }

  // Private: 45 mails from friends and family.
  const friends = [
    ['Anna Beispiel', 'anna@example.org'],
    ['Ben Muster', 'ben@example.org'],
    ['Oma Beispiel', 'oma@example.org'],
    ['Lea Musterfrau', 'lea@example.org'],
  ] as const;
  for (let k = 0; k < 45; k++) {
    const [name, email] = friends[k % friends.length]!;
    const answered = k % 5 !== 2;
    add({
      from: { name, email },
      subject: ['Wochenende?', 'Fotos vom Ausflug', 'Geburtstag', 'Kurze Frage', 'Rezept'][k % 5]!,
      snippet: answered ? 'Schön, bis bald!' : 'Hast du Zeit? Sag mir bitte Bescheid.',
      text: answered
        ? 'Schön, bis bald!'
        : 'Hallo!\n\nHast du Zeit? Sag mir bitte Bescheid.\n\nLiebe Grüße',
      daysAgo: Math.floor(k * 3.3),
      unread: !answered && k < 15,
      labels: ['INBOX', ...(!answered && k < 15 ? ['UNREAD'] : []), ...(answered ? ['SENT'] : [])],
      personal: true,
      messageCount: answered ? 2 : 1,
      lastFromMe: answered,
    });
  }

  // Task 4 „wartet auf eine Antwort von mir": personal, not newsletter, newest message not mine, within 30 days.
  for (const m of out)
    if (m.personal && !m.lastFromMe && m.daysAgo <= 30 && /\?/.test(m.text))
      TARGETS.waiting.push(m.id);
  // Task 5 „diese Woche neu und wichtig": the last 7 days, unread, not a newsletter, from a person or an office.
  for (const m of out)
    if (m.daysAgo < 7 && m.unread && !m.labels.includes('CATEGORY_PROMOTIONS'))
      TARGETS.weekImportant.push(m.id);
  return out;
}

/** Epoch ms of a mail in the browser's local time (the page clock is fixed to TODAY 10:00). */
export function at(daysAgo: number, time: string): number {
  const d = new Date(`${TODAY}T${time}:00`);
  d.setDate(d.getDate() - daysAgo);
  return d.getTime();
}

/** Rows for `mail_thread` and `mail_body` (the demo fields in the clear, like the seed). */
export function cacheRows(mails: FixtureMail[]) {
  const env = (id: string) => ({
    id,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 'e2e',
    deletedAt: null,
    _f: {},
  });
  const thread = mails.map((m) => ({
    ...env(`demo|${m.id}`),
    accountKey: 'demo',
    threadId: m.id,
    sortKey: at(m.daysAgo, m.time),
    unread: m.unread,
    inbox: m.labels.includes('INBOX'),
    demo: {
      from: m.from,
      subject: m.subject,
      snippet: m.snippet,
      messageCount: m.messageCount,
      hasAttachment: m.attachments.length > 0,
      labelIds: m.labels,
      personal: m.personal,
      ...(m.lastFromMe ? { lastFromMe: true } : {}),
    },
  }));
  const body = mails.map((m) => ({
    ...env(`demo|${m.id}-m1`),
    accountKey: 'demo',
    messageId: `${m.id}-m1`,
    threadId: m.id,
    sortKey: at(m.daysAgo, m.time),
    demo: {
      from: m.from,
      to: [ME],
      subject: m.subject,
      date: at(m.daysAgo, m.time),
      text: m.text,
      ...(m.attachments.length ? { attachments: m.attachments } : {}),
    },
  }));
  return { thread, body };
}
