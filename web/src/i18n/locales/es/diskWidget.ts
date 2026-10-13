import type { Strings } from '@/strings';

export const diskWidget: Strings['diskWidget'] = {
  title: 'Unidades',
  free: (free: string, total: string) => `${free} libres de ${total}`,
  empty: 'No se encontraron unidades.',
  open: 'Abrir almacenamiento',
  unavailable: 'Las unidades no están disponibles aquí.',
};
