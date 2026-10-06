import { usePaletteEffect } from '@/core/supporter/palette';
import { useSupporter } from '@/core/supporter';

/** Keeps the supporter colour theme (and the themed logo) on `<html>` in step with the status. */
export function SupporterEffects() {
  const { tier } = useSupporter();
  usePaletteEffect(tier !== 'none');
  return null;
}
