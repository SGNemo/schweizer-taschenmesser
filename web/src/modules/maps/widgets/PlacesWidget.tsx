import { useNavigate } from 'react-router';
import { t } from '@/strings';
import { Icon, TileGrid } from '@/ui';
import { CATEGORY_ICON, MODE_ICON } from '../icons';
import type { PlaceCategory, RouteMode } from '../schema';
import { useTiles } from './usePlaces';

/** Saved places and routes as quick-launch tiles: one tap opens the place on the map or the route to edit. Makes no request. */
export default function PlacesWidget() {
  const tiles = useTiles();
  const navigate = useNavigate();
  return (
    <TileGrid
      loading={!tiles}
      empty={t.maps.widget.empty}
      emptyAction={{ label: t.maps.widget.addPlace, to: '/maps?new=1' }}
      entries={(tiles ?? []).map((x) => ({
        key: x.key,
        label: x.label,
        icon: (
          <Icon
            name={
              x.kind === 'place'
                ? CATEGORY_ICON[x.icon as PlaceCategory]
                : MODE_ICON[x.icon as RouteMode]
            }
            size={22}
          />
        ),
        onOpen: () => navigate(`/maps?open=${x.id}`),
      }))}
    />
  );
}
