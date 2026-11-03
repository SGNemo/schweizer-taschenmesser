import { formatDay, today } from '@/core/time/dates';
import { t } from '@/strings';

export const TEMPLATE_IDS = ['meeting', 'diary', 'list'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** Title and Markdown body of a new page made from a template (the date comes from `today()`). */
export function buildTemplate(id: TemplateId): { title: string; body: string } {
  const tpl = t.notes.templates;
  const date = formatDay(today(), 'PPP');
  if (id === 'meeting') return { title: tpl.meetingTitle(date), body: tpl.meetingBody };
  if (id === 'diary') return { title: tpl.diaryTitle(date), body: tpl.diaryBody };
  return { title: tpl.listTitle, body: tpl.listBody };
}
