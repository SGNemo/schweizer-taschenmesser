// Round 9 – the final candidate: mark A2b, pill W10c3 with the F4 proportions (final.params.mjs).
// Rendered by `node render.mjs rounds/9`.
import { LOCKUP, MARK, WORD } from '../../final.params.mjs';

export default {
  title: 'Final candidate: A2b + NEMO pill (F4)',
  subtitle:
    'Everything from final.params.mjs: the mark in every context, the pill (mark 1.3, gap 0.24, padding 0.36 / 0.3) at 36 px in the sidebar head, the tile alone in the rail (28 px) and on the phone (32 px).',
  current: false,
  lockupHeight: 36,
  lockupWord: WORD,
  lockup: LOCKUP,
  wordmarkBase: 'Final',
  wordmarkIntro: 'The chosen lockup once more with true pixels; nothing else changes in this round.',
  variants: [
    {
      label: 'Final',
      direction: MARK.direction,
      title: 'Mark A2b',
      desc: 'Round body, fan tail, dorsal and ventral fin, head band curving with the gill line, wider middle band, eye r 26; tile radius 146, fish at 0.8; Android adaptive at 0.56.',
      params: MARK.params,
      rail: 'app',
      notes: '16 px: body, two bands, tail, eye a 1 px dot. One colour: same shape. Safe zone 153 of 156. Rail 28 px, phone 32 px, wide sidebar: the pill at 36 px.',
    },
  ],
  wordmarks: [
    {
      label: 'F4',
      title: 'NEMO pill · mark 1.3, gap 0.24, padding 0.36 / 0.3 · 36 px',
      word: WORD,
      lockup: LOCKUP,
      notes: 'As chosen in round 8.',
    },
  ],
};
