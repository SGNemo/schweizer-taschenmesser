import type { Strings } from '@/strings';

export const diskWidget: Strings['diskWidget'] = {
  title: 'Laufwerke',
  free: (free: string, total: string) => `${free} frei von ${total}`,
  empty: 'Keine Laufwerke gefunden.',
  open: 'Datenträger öffnen',
  unavailable: 'Laufwerke sind hier nicht verfügbar.',
};
