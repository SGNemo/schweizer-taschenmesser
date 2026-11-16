import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

/**
 * Test data for the Dev-Preview, e2e tests and screenshots: a short conversation with the demo
 * phone (the fake shell's „Pixel 7“). Pure and deterministic; invented content only.
 */
const PEER = 'ab'.repeat(32);

const CARDS: { direction: 'in' | 'out'; kind: 'text' | 'link'; body: string; unseen: boolean }[] = [
  {
    direction: 'out',
    kind: 'link',
    body: 'https://example.org/rezepte/linsensuppe',
    unseen: false,
  },
  {
    direction: 'in',
    kind: 'text',
    body: 'Vergiss nicht, die Waschmaschine auszuräumen.',
    unseen: false,
  },
  { direction: 'in', kind: 'link', body: 'https://example.org/fahrplan/linie-7', unseen: true },
];

function seed(ctx: SeedContext): SeedRows {
  return {
    item: CARDS.map((c, i) => ({
      id: ctx.id('exchange', 'item', i),
      data: {
        peer: PEER,
        itemId: (i + 1).toString(16).padStart(32, '0'),
        direction: c.direction,
        kind: c.kind,
        body: c.body,
        state: c.direction === 'out' ? 'delivered' : 'received',
        unseen: c.unseen,
      },
    })),
  };
}

export default { seed } satisfies SeedModule;
