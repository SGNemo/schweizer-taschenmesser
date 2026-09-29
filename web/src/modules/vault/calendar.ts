import { notDeleted } from '@/core/db/repo';
import type { CalendarSource } from '@/core/modules/types';
import { t } from '@/strings';
import { documentRepo } from './repo';

const source: CalendarSource = async (range) => {
  const docs = await documentRepo.table
    .where('expiresOn')
    .between(range.from, range.to, true, true)
    .filter(notDeleted)
    .toArray();
  return docs.map((d) => ({
    id: d.id,
    source: 'vault',
    kind: 'expiry',
    title: t.vault.expiresTitle(d.title),
    date: d.expiresOn!,
    allDay: true,
    to: '/vault',
  }));
};

export default source;
