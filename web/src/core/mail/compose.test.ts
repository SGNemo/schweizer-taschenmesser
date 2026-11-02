import { describe, expect, it } from 'vitest';
import { parseRecipients } from './address';
import { buildMime, buildRaw, ComposeError, encodeWords } from './compose';
import { forwardFields, replyFields } from './reply';
import type { MailMessage, OutgoingMail } from './types';

const base: OutgoingMail = {
  to: [{ name: 'Anna Beispiel', email: 'anna@example.org' }],
  cc: [],
  bcc: [],
  subject: 'Hallo',
  text: 'Zeile 1\nZeile 2',
  attachments: [],
};

const decodeBody = (mime: string): string => {
  const body = mime.split('\r\n\r\n')[1]!.replace(/\r\n/g, '');
  return new TextDecoder().decode(Uint8Array.from(atob(body), (c) => c.charCodeAt(0)));
};

describe('buildMime', () => {
  it('writes headers, a UTF-8 base64 body and CRLF line ends', () => {
    const mime = buildMime({ ...base, text: 'Grüße\nZeile 2', subject: 'Rechnung für Oktober €' });
    expect(mime).toContain('To: "Anna Beispiel" <anna@example.org>');
    expect(mime).toContain('Subject: =?UTF-8?B?');
    expect(mime).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(mime).toContain('MIME-Version: 1.0');
    expect(mime).not.toMatch(/(^|[^\r])\n/); // every line break is CRLF
    expect(decodeBody(mime)).toBe('Grüße\r\nZeile 2');
  });

  it('keeps ASCII subjects as they are and encodes long non-ASCII subjects in several words', () => {
    expect(encodeWords('Hello World')).toBe('Hello World');
    const long = encodeWords('Überweisung '.repeat(8));
    expect(long.split(' ').every((w) => w.length <= 75)).toBe(true);
    const decoded = long
      .split(' ')
      .map((w) =>
        new TextDecoder().decode(Uint8Array.from(atob(w.slice(10, -2)), (c) => c.charCodeAt(0))),
      )
      .join('');
    expect(decoded).toBe('Überweisung '.repeat(8));
  });

  it('adds cc, bcc and the reply headers', () => {
    const mime = buildMime({
      ...base,
      cc: [{ email: 'cc@example.org' }],
      bcc: [{ email: 'bcc@example.org' }],
      inReplyTo: { messageId: '<m2@example.org>', references: '<m1@example.org> <m2@example.org>' },
    });
    expect(mime).toContain('Cc: cc@example.org');
    expect(mime).toContain('Bcc: bcc@example.org');
    expect(mime).toContain('In-Reply-To: <m2@example.org>');
    expect(mime).toContain('References: <m1@example.org> <m2@example.org>');
  });

  it('builds a multipart message with attachments (base64, encoded file name)', () => {
    const mime = buildMime(
      {
        ...base,
        attachments: [
          {
            filename: 'Übersicht.pdf',
            mime: 'application/pdf',
            data: new Uint8Array([1, 2, 3, 250]),
          },
        ],
      },
      { boundary: 'B1' },
    );
    expect(mime).toContain('Content-Type: multipart/mixed; boundary="B1"');
    expect(mime).toContain('Content-Type: application/pdf');
    expect(mime).toContain("filename*=UTF-8''%C3%9Cbersicht.pdf");
    expect(mime).toContain('AQID+g==');
    expect(mime.trimEnd().endsWith('--B1--')).toBe(true);
  });

  it('refuses header injection, bad addresses, no recipient and oversized mail', () => {
    expect(() => buildMime({ ...base, subject: 'Hi\r\nBcc: evil@example.org' })).toThrow(
      ComposeError,
    );
    expect(() => buildMime({ ...base, to: [{ name: 'A\nB', email: 'a@example.org' }] })).toThrow(
      ComposeError,
    );
    expect(() => buildMime({ ...base, to: [{ email: 'not-an-address' }] })).toThrow(ComposeError);
    expect(() => buildMime({ ...base, to: [] })).toThrow(ComposeError);
    expect(() =>
      buildMime({
        ...base,
        attachments: [{ filename: 'x', mime: 'a/b', data: new Uint8Array(19 * 1024 * 1024) }],
      }),
    ).toThrow(ComposeError);
  });

  it('raw is base64url of the message', () => {
    const raw = buildRaw(base);
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    const mime = new TextDecoder().decode(
      Uint8Array.from(atob(raw.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
    );
    expect(mime).toContain('Subject: Hallo');
  });
});

describe('parseRecipients', () => {
  it('splits on comma and semicolon and reports what is not an address', () => {
    const r = parseRecipients('Anna <anna@example.org>; ben@example.org, kaputt');
    expect(r.valid.map((a) => a.email)).toEqual(['anna@example.org', 'ben@example.org']);
    expect(r.invalid).toEqual(['kaputt']);
    expect(parseRecipients('  ')).toEqual({ valid: [], invalid: [] });
  });
});

const message: MailMessage = {
  id: 'm2',
  threadId: 't1',
  from: { name: 'Max', email: 'max@example.org' },
  to: [{ email: 'me@example.org' }, { email: 'anna@example.org' }],
  cc: [{ email: 'cc@example.org' }],
  subject: 'AW: Re: Treffen',
  date: 0,
  labelIds: [],
  unread: false,
  attachments: [],
  inline: [],
  rfcMessageId: '<m2@example.org>',
  references: '<m1@example.org>',
};

describe('replyFields / forwardFields', () => {
  it('replies to the sender with a quoted text and keeps the conversation', () => {
    const r = replyFields(message, {
      all: false,
      quoteHeader: 'Max schrieb:',
      body: 'Hallo\nWelt',
    });
    expect(r).toMatchObject({
      to: 'Max <max@example.org>',
      cc: '',
      subject: 'Re: Treffen',
      threadId: 't1',
      inReplyTo: { messageId: '<m2@example.org>', references: '<m1@example.org> <m2@example.org>' },
    });
    expect(r.text).toBe('\n\nMax schrieb:\n> Hallo\n> Welt');
  });

  it('reply all takes the others but not me and not the sender', () => {
    const r = replyFields(message, { all: true, me: 'me@example.org', quoteHeader: 'x', body: '' });
    expect(r.cc).toBe('anna@example.org, cc@example.org');
  });

  it('forward starts a new conversation without recipients or attachments', () => {
    const f = forwardFields(message, { header: '---- Weitergeleitet ----', body: 'Text' });
    expect(f).toMatchObject({ to: '', subject: 'Fwd: Treffen', threadId: undefined });
    expect(f.text).toContain('Text');
  });
});
