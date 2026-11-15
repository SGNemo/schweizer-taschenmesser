import { useNavigate } from 'react-router';
import { useLinks } from '@/core/entitylinks';
import { t } from '@/strings';
import { Badge, Icon, IconButton } from '@/ui';

/**
 * Is an entry that runs low already on the shopping list? The list entry made from it carries a link back
 * (`_links`, written by the lists module on `shopping.requested` with `ref`); while that entry is open the route
 * to it is returned. A bought (ticked) or removed entry no longer counts: the pantry entry reads „Wird knapp“
 * again. Read through core only – this module knows nothing about lists.
 */
function useOnList(id: string): string | undefined {
  const link = useLinks({ module: 'pantry', id })?.find(
    (l) => l.direction === 'in' && l.state.state === 'alive' && !l.state.done,
  );
  return link?.state.state === 'alive' ? link.state.to : undefined;
}

/** The one badge of an entry that runs low: „Wird knapp“, or „Auf der Einkaufsliste“ once it is there. */
export function LowBadge({ id }: { id: string }) {
  return <Badge>{useOnList(id) ? t.pantry.onList : t.pantry.lowStock}</Badge>;
}

/** The cart of an entry that runs low: sends it to the shopping list, or leads to its entry there. */
export function RestockButton({
  id,
  name,
  onRestock,
}: {
  id: string;
  name: string;
  onRestock: () => void;
}) {
  const to = useOnList(id);
  const navigate = useNavigate();
  return (
    <IconButton
      label={to ? t.pantry.toList(name) : t.pantry.restockOne(name)}
      onClick={() => (to ? void navigate(to) : onRestock())}
    >
      <Icon name="cart" size={18} />
    </IconButton>
  );
}
