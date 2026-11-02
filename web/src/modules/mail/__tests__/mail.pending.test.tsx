// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorError } from '@/core/connectors/types';
import type { MailAccountRef } from '@/core/mail/types';
import { useUiStore } from '@/stores/ui';

const sendMock = vi.fn();
const deleteDraftMock = vi.fn();
vi.mock('@/core/mail/service', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  mailSend: (...a: unknown[]) => sendMock(...a),
  mailDeleteDraft: (...a: unknown[]) => deleteDraftMock(...a),
}));

import { PendingSendBar } from '../components/PendingSendBar';
import { emptyCompose } from '../composeState';
import { queueSend, resetPendingSends, SEND_WINDOW_MS, usePendingSends } from '../pendingSend';

const account: MailAccountRef = {
  key: 'google',
  connectorId: 'google',
  features: ['mail', 'mail-modify', 'mail-send'],
};
const state = emptyCompose({
  to: 'Anna <anna@example.org>',
  subject: 'Hallo',
  text: 'Text',
  threadId: 't1',
  inReplyTo: { messageId: '<m@example.org>', references: '<m@example.org>' },
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  sendMock.mockReset().mockResolvedValue({ id: 's', threadId: 't1' });
  deleteDraftMock.mockReset().mockResolvedValue(undefined);
  useUiStore.setState({ toasts: [] });
});
afterEach(() => {
  resetPendingSends();
  vi.useRealTimers();
});

describe('the send window', () => {
  it('sends nothing before the window is over, then sends once', async () => {
    queueSend(account, state);
    expect(sendMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SEND_WINDOW_MS - 1);
    expect(sendMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0]![1]).toMatchObject({
      to: [{ name: 'Anna', email: 'anna@example.org' }],
      subject: 'Hallo',
      threadId: 't1',
      inReplyTo: { messageId: '<m@example.org>' },
    });
    expect(usePendingSends.getState().items).toHaveLength(0);
    expect(useUiStore.getState().toasts.at(-1)?.message).toBe('Mail gesendet.');
  });

  it('withdrawing sends nothing and hands the text back', async () => {
    const id = queueSend(account, state)!;
    const { withdraw } = await import('../pendingSend');
    expect(withdraw(id)).toEqual(state);
    await vi.advanceTimersByTimeAsync(SEND_WINDOW_MS * 3);
    expect(sendMock).not.toHaveBeenCalled();
    expect(usePendingSends.getState().items).toHaveLength(0);
  });

  it('does not queue without the send permission or with a bad address', () => {
    expect(queueSend({ ...account, features: ['mail', 'mail-modify'] }, state)).toBeUndefined();
    expect(queueSend(account, emptyCompose({ to: 'kaputt' }))).toBeUndefined();
    expect(queueSend(account, emptyCompose())).toBeUndefined();
    expect(usePendingSends.getState().items).toHaveLength(0);
  });

  it('a failed send stays visible, delivers nothing, and can be retried', async () => {
    sendMock.mockRejectedValueOnce(new ConnectorError('denied'));
    const id = queueSend(account, state)!;
    await vi.advanceTimersByTimeAsync(SEND_WINDOW_MS + 1);
    expect(usePendingSends.getState().items[0]).toMatchObject({ phase: 'failed', error: 'denied' });
    const { sendNow } = await import('../pendingSend');
    sendNow(id);
    await vi.advanceTimersByTimeAsync(1);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(usePendingSends.getState().items).toHaveLength(0);
  });

  it('deletes the draft after sending it (manage permission only)', async () => {
    queueSend(account, { ...state, draftId: 'd1' });
    await vi.advanceTimersByTimeAsync(SEND_WINDOW_MS + 1);
    expect(deleteDraftMock).toHaveBeenCalledWith(account, 'd1');
    deleteDraftMock.mockClear();
    queueSend({ ...account, features: ['mail', 'mail-send'] }, { ...state, draftId: 'd2' });
    await vi.advanceTimersByTimeAsync(SEND_WINDOW_MS + 1);
    expect(deleteDraftMock).not.toHaveBeenCalled();
  });
});

describe('PendingSendBar', () => {
  it('counts down, lets the user withdraw (text comes back) or send now', async () => {
    const reopened = vi.fn();
    render(<PendingSendBar onReopen={reopened} />);
    act(() => void queueSend(account, state));
    expect(screen.getByText(/Mail an Anna wird in 10 s gesendet/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText(/in 6 s gesendet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zurückziehen' }));
    expect(reopened).toHaveBeenCalledWith(state, account);
    act(() => {
      vi.advanceTimersByTime(SEND_WINDOW_MS);
    });
    expect(sendMock).not.toHaveBeenCalled();

    act(() => void queueSend(account, state));
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt senden' }));
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
