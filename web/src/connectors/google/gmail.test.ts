import { describe, expect, it } from 'vitest';
import { ConnectorError, type ConnectorContext } from '@/core/connectors/types';
import { decodeBase64Url, gmailProvider, parseAddress, parseAddressList } from './gmail';

const b64url = (bytes: Uint8Array | string) => {
  const arr = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const hdr = (name: string, value: string) => ({ name, value });

function mock(handler: (url: URL, call: number) => Response) {
  const urls: URL[] = [];
  const requests: { method: string; url: URL; body: unknown }[] = [];
  const refreshes: boolean[] = [];
  let calls = 0;
  const fetchFn = (async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    urls.push(url);
    requests.push({
      method: init?.method ?? 'GET',
      url,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return handler(url, calls++);
  }) as unknown as typeof fetch;
  const ctx: ConnectorContext = {
    fetch: fetchFn,
    accessToken: async (opts) => {
      refreshes.push(Boolean(opts?.refresh));
      return 'AT';
    },
    fetchPublic: fetchFn,
    secrets: {
      get: async () => undefined,
      set: async () => undefined,
      delete: async () => undefined,
    },
    redact: (t) => t,
  };
  return { ctx, urls, refreshes, requests };
}

const metaThread = (id: string, subject: string, unread: boolean) => ({
  id,
  messages: [
    {
      id: `${id}-1`,
      labelIds: ['INBOX'],
      snippet: 'erste',
      internalDate: '1760000000000',
      payload: { headers: [hdr('From', 'Max <max@example.org>'), hdr('Subject', subject)] },
    },
    {
      id: `${id}-2`,
      labelIds: unread ? ['INBOX', 'UNREAD'] : ['INBOX'],
      snippet: 'neueste Antwort',
      internalDate: '1760100000000',
      payload: {
        headers: [hdr('From', 'Anna <anna@example.org>'), hdr('Subject', `Re: ${subject}`)],
      },
    },
  ],
});

describe('addresses', () => {
  it('parses names, quoted names and lists', () => {
    expect(parseAddress('"Muster, Max" <max@example.org>')).toEqual({
      name: 'Muster, Max',
      email: 'max@example.org',
    });
    expect(parseAddress('plain@example.org')).toEqual({ email: 'plain@example.org' });
    expect(
      parseAddressList('"A, B" <a@example.org>, c@example.org, D <d@example.org>'),
    ).toHaveLength(3);
  });
});

describe('gmailProvider.threads', () => {
  it('lists threads with the newest sender, first subject, unread flag; read-only scope endpoints only', async () => {
    const { ctx, urls } = mock((url) =>
      url.pathname.endsWith('/threads')
        ? json({ threads: [{ id: 't1', snippet: 's' }, { id: 't2' }], nextPageToken: 'NEXT' })
        : json(
            metaThread(
              url.pathname.split('/').pop()!,
              url.pathname.endsWith('t1') ? 'Rechnung' : 'Hallo',
              url.pathname.endsWith('t1'),
            ),
          ),
    );
    const page = await gmailProvider.threads(ctx, { labelIds: ['INBOX'] });
    expect(page.nextPageToken).toBe('NEXT');
    expect(page.threads.map((t) => [t.id, t.subject, t.unread, t.messageCount])).toEqual([
      ['t1', 'Rechnung', true, 2],
      ['t2', 'Hallo', false, 2],
    ]);
    expect(page.threads[0]).toMatchObject({
      from: { name: 'Anna', email: 'anna@example.org' },
      snippet: 'neueste Antwort',
    });
    const list = urls[0]!;
    expect(list.searchParams.getAll('labelIds')).toEqual(['INBOX']);
    const detail = urls[1]!;
    expect(detail.searchParams.get('format')).toBe('metadata');
    // only GETs against gmail.googleapis.com: nothing can modify the mailbox with this scope
    expect(urls.every((u) => u.host === 'gmail.googleapis.com')).toBe(true);
  });

  it('asks for List-Unsubscribe and Precedence and keeps only the derived „personal“ flag', async () => {
    const bulk = metaThread('t3', 'Newsletter', false);
    bulk.messages[1]!.payload.headers.push(hdr('List-Unsubscribe', '<mailto:out@example.org>'));
    const { ctx, urls } = mock((url) =>
      url.pathname.endsWith('/threads')
        ? json({ threads: [{ id: 't1' }, { id: 't3' }] })
        : json(url.pathname.endsWith('t3') ? bulk : metaThread('t1', 'Hallo', false)),
    );
    const page = await gmailProvider.threads(ctx, {});
    expect(urls[1]!.searchParams.getAll('metadataHeaders')).toEqual(
      expect.arrayContaining(['List-Unsubscribe', 'Precedence']),
    );
    expect(page.threads.map((t) => [t.id, t.personal])).toEqual([
      ['t1', true],
      ['t3', false],
    ]);
    // Only the boolean leaves the provider: no raw header in the summary.
    expect(JSON.stringify(page.threads)).not.toContain('mailto:out@');
  });

  it('passes the search text through untouched (Gmail syntax)', async () => {
    const { ctx, urls } = mock(() => json({}));
    const q = 'from:"Stadtwerke" has:attachment newer_than:30d -label:spam';
    await gmailProvider.threads(ctx, { query: `  ${q}  ` });
    expect(urls[0]!.searchParams.get('q')).toBe(q);
  });
});

describe('gmailProvider.thread', () => {
  it('parses multipart mail: text + html parts, charset, attachment, inline image, recipients', async () => {
    const latin1 = new Uint8Array([0x47, 0x72, 0xfc, 0xdf, 0x65]); // "Grüße" in windows-1252
    const { ctx, urls } = mock(() =>
      json({
        id: 't1',
        messages: [
          {
            id: 'm1',
            threadId: 't1',
            labelIds: ['INBOX', 'UNREAD'],
            internalDate: '1760000000000',
            payload: {
              mimeType: 'multipart/mixed',
              headers: [
                hdr('From', 'Stadtwerke <rechnung@example.org>'),
                hdr('To', 'ich@example.org, "Du, Er" <du@example.org>'),
                hdr('Cc', 'cc@example.org'),
                hdr('Subject', 'Ihre Rechnung'),
              ],
              parts: [
                {
                  mimeType: 'multipart/alternative',
                  parts: [
                    {
                      mimeType: 'text/plain',
                      headers: [hdr('Content-Type', 'text/plain; charset="windows-1252"')],
                      body: { data: b64url(latin1), size: 5 },
                    },
                    {
                      mimeType: 'text/html',
                      headers: [hdr('Content-Type', 'text/html; charset=utf-8')],
                      body: { data: b64url('<p>Hallo <img src="cid:logo"></p>') },
                    },
                  ],
                },
                {
                  mimeType: 'image/png',
                  headers: [hdr('Content-ID', '<logo>')],
                  body: { attachmentId: 'ATT-I', size: 100 },
                },
                {
                  mimeType: 'application/pdf',
                  filename: 'rechnung.pdf',
                  headers: [hdr('Content-Disposition', 'attachment; filename="rechnung.pdf"')],
                  body: { attachmentId: 'ATT-1', size: 2048 },
                },
              ],
            },
          },
        ],
      }),
    );
    const thread = await gmailProvider.thread(ctx, 't1');
    expect(urls[0]!.searchParams.get('format')).toBe('full');
    const m = thread.messages[0]!;
    expect(m).toMatchObject({ id: 'm1', unread: true, subject: 'Ihre Rechnung' });
    expect(m.text).toBe('Grüße');
    expect(m.html).toContain('cid:logo');
    expect(m.to.map((a) => a.email)).toEqual(['ich@example.org', 'du@example.org']);
    expect(m.cc).toHaveLength(1);
    expect(m.attachments).toEqual([
      { id: 'ATT-1', filename: 'rechnung.pdf', mime: 'application/pdf', size: 2048 },
    ]);
    expect(m.inline).toEqual([
      { contentId: 'logo', mime: 'image/png', attachmentId: 'ATT-I', size: 100 },
    ]);
  });

  it('downloads an attachment as bytes', async () => {
    const bytes = new Uint8Array([1, 2, 250, 251, 252]);
    const { ctx, urls } = mock(() => json({ size: 5, data: b64url(bytes) }));
    const out = await gmailProvider.attachment(ctx, 'm1', 'ATT-1');
    expect([...out]).toEqual([...bytes]);
    expect(urls[0]!.pathname).toBe('/gmail/v1/users/me/messages/m1/attachments/ATT-1');
    expect([...decodeBase64Url(b64url(bytes))]).toEqual([...bytes]);
  });
});

describe('labels and unread', () => {
  it('lists labels and counts unread threads for the inbox and own labels', async () => {
    const { ctx } = mock((url) => {
      if (url.pathname.endsWith('/labels'))
        return json({
          labels: [
            { id: 'INBOX', name: 'INBOX', type: 'system' },
            { id: 'SENT', name: 'SENT', type: 'system' },
            { id: 'Label_1', name: 'Belege', type: 'user' },
          ],
        });
      return json({ threadsUnread: url.pathname.endsWith('INBOX') ? 7 : 2 });
    });
    const labels = await gmailProvider.labels(ctx);
    expect(labels.map((l) => [l.id, l.kind, l.unread])).toEqual([
      ['INBOX', 'system', 7],
      ['SENT', 'system', undefined],
      ['Label_1', 'user', 2],
    ]);
    expect(await gmailProvider.unread(ctx)).toBe(7);
  });
});

describe('errors', () => {
  it('maps a missing scope (403) to denied', async () => {
    const { ctx } = mock(() =>
      json(
        {
          error: {
            message: 'Request had insufficient authentication scopes.',
            errors: [{ reason: 'insufficientPermissions' }],
          },
        },
        403,
      ),
    );
    await expect(gmailProvider.threads(ctx, {})).rejects.toMatchObject({ code: 'denied' });
  });

  it('refreshes the token once after a 401 and then succeeds', async () => {
    const { ctx, refreshes } = mock((_url, call) =>
      call === 0 ? json({}, 401) : json({ threadsUnread: 3 }),
    );
    expect(await gmailProvider.unread(ctx)).toBe(3);
    expect(refreshes).toEqual([false, true, false]);
  });

  it('reports expired when the token stays invalid', async () => {
    const { ctx } = mock(() => json({}, 401));
    const err = await gmailProvider.unread(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectorError);
    expect((err as ConnectorError).code).toBe('expired');
  });

  it('passes a refresh failure (revoked token) on as expired', async () => {
    const { ctx } = mock(() => json({}, 401));
    ctx.accessToken = async (opts) => {
      if (opts?.refresh) throw new ConnectorError('expired', 'invalid_grant');
      return 'AT';
    };
    await expect(gmailProvider.unread(ctx)).rejects.toMatchObject({ code: 'expired' });
  });

  it('maps rate limits', async () => {
    const { ctx } = mock(() => json({ error: { errors: [{ reason: 'rateLimitExceeded' }] } }, 429));
    await expect(gmailProvider.unread(ctx)).rejects.toMatchObject({ code: 'rate-limited' });
  });
});

describe('webUrl', () => {
  it('links to the right account', () => {
    expect(gmailProvider.webUrl!('abc', 'me@example.org')).toBe(
      'https://mail.google.com/mail/?authuser=me%40example.org#all/abc',
    );
  });
});

describe('write side (opt-in, only called after the UI confirmed)', () => {
  const raw = (body: unknown) => {
    const r = (body as { raw: string }).raw.replace(/-/g, '+').replace(/_/g, '/');
    return new TextDecoder().decode(Uint8Array.from(atob(r), (c) => c.charCodeAt(0)));
  };
  const mail = {
    to: [{ email: 'anna@example.org' }],
    cc: [],
    bcc: [],
    subject: 'Hallo',
    text: 'Text',
    attachments: [],
  };

  it('modify posts the label change; trash and untrash use their own endpoints', async () => {
    const { ctx, requests } = mock(() => json({}));
    await gmailProvider.modify!(ctx, 't1', { removeLabelIds: ['UNREAD'] });
    await gmailProvider.modify!(ctx, 't1', { addLabelIds: ['Label_1'], removeLabelIds: ['INBOX'] });
    await gmailProvider.trash!(ctx, 't1');
    await gmailProvider.untrash!(ctx, 't1');
    expect(requests.map((r) => [r.method, r.url.pathname])).toEqual([
      ['POST', '/gmail/v1/users/me/threads/t1/modify'],
      ['POST', '/gmail/v1/users/me/threads/t1/modify'],
      ['POST', '/gmail/v1/users/me/threads/t1/trash'],
      ['POST', '/gmail/v1/users/me/threads/t1/untrash'],
    ]);
    expect(requests[0]!.body).toEqual({ addLabelIds: [], removeLabelIds: ['UNREAD'] });
    expect(requests[1]!.body).toEqual({ addLabelIds: ['Label_1'], removeLabelIds: ['INBOX'] });
  });

  it('send posts the raw message; a reply names its thread and the message it answers', async () => {
    const { ctx, requests } = mock(() => json({ id: 'sent1', threadId: 't9' }));
    const done = await gmailProvider.send!(ctx, {
      ...mail,
      threadId: 't9',
      inReplyTo: { messageId: '<m1@example.org>', references: '<m1@example.org>' },
    });
    expect(done).toEqual({ id: 'sent1', threadId: 't9' });
    const [req] = requests;
    expect([req!.method, req!.url.pathname]).toEqual(['POST', '/gmail/v1/users/me/messages/send']);
    expect((req!.body as { threadId: string }).threadId).toBe('t9');
    expect(raw(req!.body)).toContain('In-Reply-To: <m1@example.org>');
    expect(raw(req!.body)).toContain('To: anna@example.org');
  });

  it('drafts: create, replace, delete and list', async () => {
    const { ctx, requests } = mock((url) =>
      url.pathname.endsWith('/drafts') && url.searchParams.has('maxResults')
        ? json({ drafts: [{ id: 'd1', message: { id: 'm1', threadId: 't1' } }, { id: 'broken' }] })
        : json({ id: 'd1', message: { id: 'm1' } }),
    );
    expect(await gmailProvider.saveDraft!(ctx, mail)).toEqual({ id: 'd1', messageId: 'm1' });
    expect(await gmailProvider.saveDraft!(ctx, mail, 'd1')).toEqual({ id: 'd1', messageId: 'm1' });
    await gmailProvider.deleteDraft!(ctx, 'd1');
    expect(await gmailProvider.drafts!(ctx)).toEqual([{ id: 'd1', messageId: 'm1' }]);
    expect(requests.map((r) => `${r.method} ${r.url.pathname}`)).toEqual([
      'POST /gmail/v1/users/me/drafts',
      'PUT /gmail/v1/users/me/drafts/d1',
      'DELETE /gmail/v1/users/me/drafts/d1',
      'GET /gmail/v1/users/me/drafts',
    ]);
  });

  it('a missing write permission is reported as denied', async () => {
    const { ctx } = mock(() =>
      json({ error: { errors: [{ reason: 'insufficientPermissions' }] } }, 403),
    );
    await expect(gmailProvider.send!(ctx, mail)).rejects.toMatchObject({ code: 'denied' });
    await expect(gmailProvider.modify!(ctx, 't1', {})).rejects.toMatchObject({ code: 'denied' });
  });

  it('refreshes the token once after a 401 on a write, then reports expired', async () => {
    const ok = mock((_u, call) => (call === 0 ? json({}, 401) : json({ id: 's', threadId: 't' })));
    await gmailProvider.send!(ok.ctx, mail);
    expect(ok.refreshes).toEqual([false, true, false]);
    expect(ok.requests).toHaveLength(2); // the 401 call did nothing, the retry sent once
    const bad = mock(() => json({}, 401));
    await expect(gmailProvider.send!(bad.ctx, mail)).rejects.toMatchObject({ code: 'expired' });
  });

  it('a mail with a header injection never reaches the network', async () => {
    const { ctx, requests } = mock(() => json({}));
    await expect(
      gmailProvider.send!(ctx, { ...mail, subject: 'x\r\nBcc: evil@example.org' }),
    ).rejects.toThrow();
    expect(requests).toHaveLength(0);
  });
});
