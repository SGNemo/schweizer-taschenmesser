import { useState } from 'react';
import { formatMoneyInput, parseMoney } from '@/core/money';
import { formatNumber } from '@/core/i18n/format';
import { t } from '@/strings';
import { DayField, SelectField, TextField, TimeField } from '@/ui';
import type { CaptureFields, CaptureRecurrence } from '../parser';
import type { CaptureFieldSpec } from '../targets';
import styles from './CaptureForm.module.css';

export type FieldKey = CaptureFieldSpec['key'];
/** What the panel changed, merged over the parsed fields; an emptied field holds `undefined`. */
export type FieldEdits = Partial<CaptureFields>;

const RHYTHMS = {
  weekly: { freq: 'weekly', interval: 1 },
  monthly: { freq: 'monthly', interval: 1 },
  quarterly: { freq: 'monthly', interval: 3 },
  yearly: { freq: 'yearly', interval: 1 },
} as const satisfies Record<string, CaptureRecurrence>;
type Rhythm = keyof typeof RHYTHMS;

function rhythmOf(r: CaptureRecurrence | undefined): Rhythm | '' {
  if (!r) return '';
  if (r.freq === 'weekly' && r.interval === 1) return 'weekly';
  if (r.freq === 'monthly' && r.interval === 1) return 'monthly';
  if (r.freq === 'monthly' && r.interval === 3) return 'quarterly';
  if (r.freq === 'yearly' && r.interval === 1) return 'yearly';
  return '';
}

/** A field counts as filled when it holds a value a save can use (a title with more than blanks). */
export function isFilled(fields: CaptureFields, key: FieldKey): boolean {
  const v = fields[key];
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return v > 0;
  return v !== undefined;
}

/** The required fields a target is still missing, as the panel's messages (shown only after a save attempt). */
export function missingFields(
  specs: readonly CaptureFieldSpec[],
  fields: CaptureFields,
): Partial<Record<FieldKey, string>> {
  return Object.fromEntries(
    specs
      .filter((s) => s.required && !isFilled(fields, s.key))
      .map((s) => [s.key, t.quickCapture.field.required]),
  );
}

/**
 * The target's fields as inputs (the mail dialog): prefilled from what the line and the mail say, editable,
 * a change wins over the line. Switching the target keeps edited values whose field the next target has too.
 */
export function FieldPanel({
  specs,
  fields,
  errors,
  onEdit,
}: {
  specs: readonly CaptureFieldSpec[];
  /** The values the entry would get now (parsed line, mail extras and edits). */
  fields: CaptureFields;
  /** Per field, only after a save attempt. */
  errors: Partial<Record<FieldKey, string>>;
  onEdit: (edits: FieldEdits) => void;
}) {
  // Text being typed into a number field; it shows until it reads as a value (or is left).
  const [drafts, setDrafts] = useState<Partial<Record<FieldKey, string>>>({});
  // Unreadable text says so once the field is left, never mid-typing.
  const [left, setLeft] = useState<Partial<Record<FieldKey, boolean>>>({});
  const tf = t.quickCapture.field;
  if (specs.length === 0) return null;

  const setDraft = (key: FieldKey, text: string | undefined) =>
    setDrafts((d) => ({ ...d, [key]: text }));
  const edit = (spec: CaptureFieldSpec, value: unknown) => {
    const filled = value !== undefined && value !== '';
    // An emptied field takes back what it wrote along (a plan's hard deadline).
    const along = spec.with
      ? filled
        ? spec.with
        : Object.fromEntries(Object.keys(spec.with).map((k) => [k, undefined]))
      : {};
    onEdit({ [spec.key]: filled ? value : undefined, ...along });
  };

  return (
    <fieldset className={styles.fieldPanel} data-testid="capture-fields">
      <legend className="sr-only">{tf.legend}</legend>
      {specs.map((spec) => (
        <div key={spec.key} data-field={spec.key}>
          {input(spec)}
        </div>
      ))}
    </fieldset>
  );

  function input(spec: CaptureFieldSpec) {
    const label = tf[spec.label];
    const error = errors[spec.key];
    switch (spec.input) {
      case 'day':
        return (
          <DayField
            label={label}
            error={error}
            value={(fields[spec.key] as string | undefined) ?? ''}
            onChange={(v) => edit(spec, v)}
          />
        );
      case 'time':
        return (
          <TimeField
            label={label}
            error={error}
            value={(fields[spec.key] as string | undefined) ?? ''}
            onChange={(v) => edit(spec, v)}
          />
        );
      case 'rhythm':
        return (
          <SelectField
            label={label}
            error={error}
            value={rhythmOf(fields.recurrence)}
            onChange={(e) => {
              const r = e.target.value as Rhythm | '';
              edit(spec, r ? { ...RHYTHMS[r] } : undefined);
            }}
          >
            <option value="">{tf.rhythmNone}</option>
            <option value="weekly">{tf.rhythmWeekly}</option>
            <option value="monthly">{tf.rhythmMonthly}</option>
            <option value="quarterly">{tf.rhythmQuarterly}</option>
            <option value="yearly">{tf.rhythmYearly}</option>
          </SelectField>
        );
      case 'money':
      case 'minutes':
      case 'number': {
        const money = spec.input === 'money';
        const current = fields[spec.key] as number | undefined;
        const draft = drafts[spec.key];
        const read = (text: string): number | undefined => {
          if (money) return parseMoney(text);
          const n = Number(text.trim());
          return Number.isInteger(n) && n > 0 ? n : undefined;
        };
        const unreadable = draft !== undefined && draft.trim() !== '' && !read(draft);
        const say = unreadable && (left[spec.key] || error !== undefined);
        return (
          <TextField
            label={label}
            inputMode={money ? 'decimal' : 'numeric'}
            autoComplete="off"
            value={
              draft ??
              (current === undefined ? '' : money ? formatMoneyInput(current) : String(current))
            }
            placeholder={money ? formatMoneyInput(1250) : formatNumber(30)}
            error={say ? (money ? tf.amountInvalid : tf.numberInvalid) : error}
            onChange={(e) => {
              setLeft((l) => ({ ...l, [spec.key]: false }));
              setDraft(spec.key, e.target.value);
              edit(spec, read(e.target.value));
            }}
            onBlur={() => {
              setLeft((l) => ({ ...l, [spec.key]: true }));
              if (!unreadable) setDraft(spec.key, undefined);
            }}
          />
        );
      }
      case 'text':
      default:
        return (
          <TextField
            label={label}
            error={error}
            autoComplete="off"
            value={(fields[spec.key] as string | undefined) ?? ''}
            onChange={(e) => onEdit({ [spec.key]: e.target.value })}
          />
        );
    }
  }
}
