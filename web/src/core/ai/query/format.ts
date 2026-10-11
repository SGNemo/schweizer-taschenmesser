import { formatTimestamp } from '@/core/i18n/format';
import { formatMoney } from '@/core/money';
import { describeRecurrence } from '@/core/recurrence/describe';
import { recurrenceSchema } from '@/core/recurrence/types';
import { formatDay } from '@/core/time/dates';
import type { AiFieldType } from '@/core/modules/types';
import { t } from '@/strings';

export const fieldLabel = (field: string): string => t.ai.fieldLabels[field] ?? field;

export const enumLabel = (value: string): string => t.ai.enumValues[value] ?? value;

/** Human readable (German) value of a stored field, or undefined when there is nothing to show. */
export function formatFieldValue(type: AiFieldType, value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (type === 'money' && typeof value === 'number') return formatMoney(value);
  if (type === 'date' && typeof value === 'string') return formatDay(value, 'EEE, d. MMM yyyy');
  if (type === 'bool') return value ? t.ai.yes : t.ai.no;
  if (type === 'ts' && typeof value === 'number') return formatTimestamp(new Date(value).getTime());
  if (type === 'recurrence') {
    const parsed = recurrenceSchema.safeParse(value);
    return parsed.success ? describeRecurrence(parsed.data) : undefined;
  }
  if (type.startsWith('enum:')) return enumLabel(String(value));
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}
