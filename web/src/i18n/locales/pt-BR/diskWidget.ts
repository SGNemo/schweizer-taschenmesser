import type { Strings } from '@/strings';

export const diskWidget: Strings['diskWidget'] = {
  title: 'Unidades',
  free: (free: string, total: string) => `${free} livres de ${total}`,
  empty: 'Nenhuma unidade encontrada.',
  open: 'Abrir unidades',
  unavailable: 'As unidades não estão disponíveis aqui.',
};
