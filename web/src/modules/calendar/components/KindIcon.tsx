import { Icon } from '@/ui';
import type { IconName } from '@/ui/icons';

/** The kind of an entry as a small icon: the colour of a capsule is the calendar, the shape is the kind. */
const KIND_ICON: Record<string, IconName> = {
  event: 'calendar',
  reminder: 'bell',
  birthday: 'cake',
  task: 'checklist',
  invoice: 'receipt',
  subscription: 'repeat',
  cancel: 'alert',
  end: 'alert',
  expiry: 'alert',
  external: 'calendarDays',
};

export function KindIcon({ kind, size = 12 }: { kind: string; size?: number }) {
  return <Icon name={KIND_ICON[kind] ?? 'calendar'} size={size} />;
}
