import { useState } from 'react';
import { CURRENCY_CHOICES, isCurrencyCode } from '@/core/money';
import { t } from '@/strings';
import { SelectField, TextField } from './Fields';

const OTHER = 'other';

/**
 * Currency of an account or invoice: a short list plus "Andere …" for any other ISO 4217 code. The
 * value is always the code; the parent checks it with `isCurrencyCode` before saving.
 */
export function CurrencyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const known = (CURRENCY_CHOICES as readonly string[]).includes(value);
  const [custom, setCustom] = useState(!known);
  const [draft, setDraft] = useState(known ? '' : value);
  const invalid = custom && draft.length === 3 && !isCurrencyCode(draft);
  return (
    <>
      <SelectField
        label={label}
        hint={t.money.currencyHint}
        value={custom ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setCustom(true);
            onChange(draft);
          } else {
            setCustom(false);
            onChange(e.target.value);
          }
        }}
      >
        {CURRENCY_CHOICES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={OTHER}>{t.money.currencyOther}</option>
      </SelectField>
      {custom ? (
        <TextField
          label={t.money.currencyCode}
          value={draft}
          maxLength={3}
          autoCapitalize="characters"
          spellCheck={false}
          error={invalid ? t.money.currencyInvalid : undefined}
          onChange={(e) => {
            const code = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
            setDraft(code);
            onChange(code);
          }}
        />
      ) : null}
    </>
  );
}
