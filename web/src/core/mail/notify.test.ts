import { describe, expect, it } from 'vitest';
import {
  afterFailure,
  applyPoll,
  emptyNotifyState,
  NOTIFY_INTERVALS,
  pollDue,
  summarize,
} from './notify';
import type { MailThreadSummary } from './types';

const MIN = 60_000;
const thread = (id: string, date: number, unread = true): MailThreadSummary => ({
  id,
  messageCount: 1,
  from: { email: 'a@example.org' },
  subject: 's',
  snippet: '',
  date,
  unread,
  labelIds: ['INBOX'],
  hasAttachment: false,
});

describe('applyPoll', () => {
  it('the first poll only sets the watermark: switching it on never announces the whole inbox', () => {
    const r = applyPoll(emptyNotifyState(), [thread('a', 100), thread('b', 200)], 1000);
    expect(r.fresh).toEqual([]);
    expect(r.state).toMatchObject({ watermark: 200, batches: [], lastPoll: 1000, failures: 0 });
  });

  it('an empty inbox on the first poll still starts from now', () => {
    expect(applyPoll(emptyNotifyState(), [], 5000).state.watermark).toBe(5000);
  });

  it('later polls: only unread threads newer than the watermark are new', () => {
    const first = applyPoll(emptyNotifyState(), [thread('a', 100)], 1000).state;
    const r = applyPoll(
      first,
      [thread('new', 300), thread('old', 50), thread('read', 400, false), thread('a', 100)],
      2000,
    );
    expect(r.fresh).toEqual(['new']);
    expect(r.state.batches).toEqual([{ at: 2000, ids: ['new'] }]);
    expect(r.state.watermark).toBe(400);
  });

  it('a thread that is in a batch already is not announced twice, a new reply is', () => {
    let s = applyPoll(emptyNotifyState(), [thread('a', 100)], 1000).state;
    s = applyPoll(s, [thread('x', 300)], 2000).state;
    expect(applyPoll(s, [thread('x', 300)], 3000).fresh).toEqual([]);
    // the same thread gets a newer message after the first batch aged out of "known": still one batch id
    const again = applyPoll(s, [thread('y', 500), thread('y', 500)], 3000);
    expect(again.fresh).toEqual(['y']);
  });

  it('forgets batches after two days', () => {
    let s = applyPoll(emptyNotifyState(), [thread('a', 100)], 1000).state;
    s = applyPoll(s, [thread('x', 300)], 2000).state;
    const later = applyPoll(s, [], 2000 + 49 * 60 * MIN);
    expect(later.state.batches).toEqual([]);
  });
});

describe('pollDue / afterFailure', () => {
  it('waits the interval, and longer after each failure (×2, ×4, ×8, then no more)', () => {
    const s = applyPoll(emptyNotifyState(), [], 0).state;
    expect(pollDue(s, 15, 14 * MIN)).toBe(false);
    expect(pollDue(s, 15, 15 * MIN)).toBe(true);
    const f1 = afterFailure(s, 15 * MIN);
    expect(pollDue(f1, 15, 15 * MIN + 29 * MIN)).toBe(false);
    expect(pollDue(f1, 15, 15 * MIN + 30 * MIN)).toBe(true);
    let f = f1;
    for (let i = 0; i < 6; i++) f = afterFailure(f, 0);
    expect(pollDue({ ...f, lastPoll: 0 }, 15, 15 * 8 * MIN)).toBe(true);
    expect(pollDue({ ...f, lastPoll: 0 }, 15, 15 * 8 * MIN - 1)).toBe(false);
  });

  it('a first run is due at once; the shortest choice is five minutes', () => {
    expect(pollDue(emptyNotifyState(), 60, 0)).toBe(true);
    expect(Math.min(...NOTIFY_INTERVALS)).toBe(5);
  });
});

describe('summarize', () => {
  const text = {
    title: (n: number) => `${n} neu`,
    senders: (names: string[], more: number) => names.join(', ') + (more ? ` +${more}` : ''),
  };
  const batch = { at: 1, ids: ['a', 'b', 'c', 'd', 'e'] };

  it('counts only what is still unread; nothing left, nothing said', () => {
    expect(summarize(batch, new Set(['a', 'b']), text)).toEqual({ title: '2 neu' });
    expect(summarize(batch, new Set(), text)).toBeUndefined();
  });

  it('carries no names by default; with names, at most three and "+n"', () => {
    const names = new Map([
      ['a', 'Anna'],
      ['b', 'Ben'],
      ['c', 'Cem'],
      ['d', 'Dora'],
      ['e', 'Anna'],
    ]);
    expect(summarize(batch, new Set(batch.ids), text)?.body).toBeUndefined();
    expect(summarize(batch, new Set(batch.ids), text, names)).toEqual({
      title: '5 neu',
      body: 'Anna, Ben, Cem +1',
    });
  });
});
