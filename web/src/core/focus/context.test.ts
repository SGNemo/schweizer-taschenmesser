import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import {
  AWAY_MS,
  dismissContext,
  getContext,
  isRememberable,
  markAway,
  recordContext,
  shouldOfferResume,
} from './context';

beforeEach(async () => {
  await db.table('_meta').clear();
});

describe('resume context', () => {
  it('remembers places, not the home screen or a focus screen', async () => {
    expect(isRememberable('/')).toBe(false);
    expect(isRememberable('/todos/focus/abc')).toBe(false);
    expect(isRememberable('/todos?list=x')).toBe(true);
    await recordContext('/', 'Übersicht');
    expect(await getContext()).toBeUndefined();
    await recordContext('/todos', ' ToDos ');
    expect(await getContext()).toEqual({ path: '/todos', title: 'ToDos' });
    await recordContext('/notes', '');
    expect((await getContext())?.title).toBe('/notes');
  });

  it('is offered only after the app was left for long enough, and only until answered', async () => {
    await recordContext('/todos', 'ToDos');
    expect(shouldOfferResume(await getContext(), 10_000_000)).toBe(false); // never left
    await markAway(1_000_000);
    await markAway(2_000_000); // already away: the first time counts
    const ctx = await getContext();
    expect(ctx?.awayAt).toBe(1_000_000);
    expect(shouldOfferResume(ctx, 1_000_000 + AWAY_MS - 1)).toBe(false);
    expect(shouldOfferResume(ctx, 1_000_000 + AWAY_MS)).toBe(true);
    await dismissContext();
    expect(shouldOfferResume(await getContext(), 1_000_000 + 2 * AWAY_MS)).toBe(false);
  });

  it('a new place clears the away mark', async () => {
    await recordContext('/todos', 'ToDos');
    await markAway(1);
    await recordContext('/notes', 'Notizen');
    expect((await getContext())?.awayAt).toBeUndefined();
  });
});
