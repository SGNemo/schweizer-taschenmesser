import { PHONE_QUERY } from './Patterns';
import { useMediaQuery } from './useMediaQuery';

/**
 * The variant of a card's main button on the overview (decision #856): filled on the desktop,
 * `secondary` below 900 px, where the plus in the bottom bar owns the one filled accent. Same
 * place and words on both; empty states keep their filled next step and do not use this.
 */
export function useCardActionVariant(): 'primary' | 'secondary' {
  return useMediaQuery(PHONE_QUERY) ? 'secondary' : 'primary';
}
