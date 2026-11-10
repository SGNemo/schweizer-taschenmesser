// Picture slots of the three draft directions (docs/design/site/RETHINK.md). A slot is a named place with a fixed
// aspect ratio; today a drawn placeholder fills it, later a real app picture of the same ratio, so the layout never
// moves. `ratio` holds from 48rem, `ratioPhone` below. Phase 3 keeps the chosen direction's slots and turns this
// table into docs/design/site/SLOTS.md and the list scripts/app-screenshots.mjs fills.
export const slots = {
  'a-day': { ratio: '3x2', ratioPhone: '4x5' },
  'a-words': { ratio: '16x9', ratioPhone: '4x3' },
  'b-schema': { ratio: '4x3', ratioPhone: '4x5' },
  'b-areas': { ratio: '3x1', ratioPhone: '4x3' },
  'c-now': { ratio: '4x3', ratioPhone: '4x5' },
  'c-morning': { ratio: '4x3', ratioPhone: '4x3' },
  'c-focus': { ratio: '4x3', ratioPhone: '4x3' },
  'c-capture': { ratio: '4x3', ratioPhone: '4x3' },
  'c-money': { ratio: '4x3', ratioPhone: '4x3' },
};
