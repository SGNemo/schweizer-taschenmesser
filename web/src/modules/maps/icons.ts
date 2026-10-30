import type { IconName } from '@/ui';
import type { PlaceCategory, RouteMode } from './schema';

export const CATEGORY_ICON: Record<PlaceCategory, IconName> = {
  home: 'home',
  work: 'wrench',
  shop: 'cart',
  health: 'activity',
  leisure: 'star',
  other: 'mapPin',
};

export const MODE_ICON: Record<RouteMode, IconName> = {
  walk: 'footprints',
  bike: 'bike',
  car: 'car',
  transit: 'train',
};
