import type { AngleMode } from '@/core/calc/engine';

/** Variables (`a = 19 %`) and `ans` live as long as the app is open; they are not stored or synced. */
export const session = {
  vars: new Map<string, unknown>(),
};

export const DEFAULT_ANGLE: AngleMode = 'deg';
