import type { Strings } from '@/strings';

export const diskWidget: Strings['diskWidget'] = {
  title: 'Drives',
  free: (free: string, total: string) => `${free} free of ${total}`,
  empty: 'No drives found.',
  open: 'Open drives',
  unavailable: 'Drives are not available here.',
};
