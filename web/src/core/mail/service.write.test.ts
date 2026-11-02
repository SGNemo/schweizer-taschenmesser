// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorError } from '@/core/connectors/types';
import type { MailAccountRef, MailProvider, OutgoingMail } from './types';

const provider: {
  [
    K in keyof Required<
      Pick<MailProvider, 'modify' | 'trash' | 'send' | 'saveDraft' | 'deleteDraft'>
    >
  ]: ReturnType<typeof vi.fn>;
} = {
  modify: vi.fn(async () => undefined),
  trash: vi.fn(async () => undefined),
  send: vi.fn(async () => ({ id: 's', threadId: 't' })),
  saveDraft: vi.fn(async () => ({ id: 'd', messageId: 'm' })),
  deleteDraft: vi.fn(async () => undefined),
};
let mailbox: Partial<MailProvider> | undefined = provider as unknown as MailProvider;

vi.mock('@/core/connectors/registry', () => ({
  getConnector: () => ({ id: 'google', mailbox }),
  connectors: [],
}));

import { mailDeleteDraft, mailModify, mailSaveDraft, mailSend, mailTrash } from './service';

const ref = (features: string[]): MailAccountRef => ({
  key: 'google',
  connectorId: 'google',
  features,
});
const mail: OutgoingMail = {
  to: [{ email: 'a@example.org' }],
  cc: [],
  bcc: [],
  subject: 's',
  text: 't',
  attachments: [],
};

beforeEach(() => {
  mailbox = provider as unknown as MailProvider;
  for (const fn of Object.values(provider)) fn.mockClear();
});

describe('writes are gated per permission', () => {
  it('reads-only account: nothing is called, the error says the permission is missing', async () => {
    const readOnly = ref(['mail']);
    await expect(mailModify(readOnly, 't1', {})).rejects.toMatchObject({ code: 'denied' });
    await expect(mailTrash(readOnly, 't1')).rejects.toMatchObject({ code: 'denied' });
    await expect(mailSend(readOnly, mail)).rejects.toMatchObject({ code: 'denied' });
    await expect(mailSaveDraft(readOnly, mail)).rejects.toMatchObject({ code: 'denied' });
    await expect(mailDeleteDraft(readOnly, 'd')).rejects.toMatchObject({ code: 'denied' });
    for (const fn of Object.values(provider)) expect(fn).not.toHaveBeenCalled();
  });

  it('manage permission allows labels, trash and drafts, but never sending', async () => {
    const manage = ref(['mail', 'mail-modify']);
    await mailModify(manage, 't1', { removeLabelIds: ['UNREAD'] });
    await mailTrash(manage, 't1');
    await mailSaveDraft(manage, mail);
    expect(provider.modify).toHaveBeenCalledTimes(1);
    expect(provider.trash).toHaveBeenCalledTimes(1);
    expect(provider.saveDraft).toHaveBeenCalledTimes(1);
    await expect(mailSend(manage, mail)).rejects.toMatchObject({ code: 'denied' });
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('send permission sends, and only sends', async () => {
    const send = ref(['mail', 'mail-send']);
    await expect(mailSend(send, mail)).resolves.toEqual({ id: 's', threadId: 't' });
    await expect(mailModify(send, 't1', {})).rejects.toMatchObject({ code: 'denied' });
    expect(provider.modify).not.toHaveBeenCalled();
  });

  it('a mailbox that cannot do it says so', async () => {
    mailbox = {};
    await expect(mailModify(ref(['mail-modify']), 't', {})).rejects.toBeInstanceOf(ConnectorError);
    await expect(mailModify(ref(['mail-modify']), 't', {})).rejects.toMatchObject({
      code: 'unsupported',
    });
  });

  it('sample mail (no features at all) can not write', async () => {
    await expect(mailModify({ key: 'demo', connectorId: 'demo' }, 't', {})).rejects.toMatchObject({
      code: 'denied',
    });
  });
});
