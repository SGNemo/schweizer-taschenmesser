import { useState } from 'react';
import { formatNumber } from '@/core/i18n/format';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Icon, SelectField, TextField } from '@/ui';
import { Flow, kit } from '../kit';
import { copyText, fmt, num } from '../shared';
import styles from '../tools.module.css';
import { convert, UNITS, type UnitKind } from './logic';

const s = t.tools.units;
const KINDS = Object.keys(UNITS) as UnitKind[];

export default function UnitsTool() {
  const toast = useUiStore((st) => st.toast);
  const [kind, setKind] = useState<UnitKind>('length');
  const [value, setValue] = useState('1');
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const units = UNITS[kind];
  // Fall back to the first units of the kind when nothing (valid) is chosen yet.
  const fromId = units.some((u) => u.id === from) ? from! : units[0]!.id;
  const toId = units.some((u) => u.id === to) ? to! : units[1]!.id;
  const v = num(value);
  const result = v !== undefined ? convert(kind, fromId, toId, v) : undefined;

  return (
    <div className={styles.stack}>
      <SelectField
        label={s.kind}
        value={kind}
        onChange={(e) => {
          setKind(e.target.value as UnitKind);
          setFrom(undefined);
          setTo(undefined);
        }}
      >
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {s.kinds[k]}
          </option>
        ))}
      </SelectField>
      <Flow
        start={
          <>
            <TextField
              label={s.value}
              className={kit.bigInput}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
            <SelectField label={s.from} value={fromId} onChange={(e) => setFrom(e.target.value)}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </SelectField>
          </>
        }
        between={<Icon name="arrowRight" size={28} />}
        end={
          <>
            <p className={kit.bigNumber} role="status" aria-label={s.result}>
              {result !== undefined ? fmt(result) : s.invalid}
            </p>
            <SelectField label={s.to} value={toId} onChange={(e) => setTo(e.target.value)}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </SelectField>
            {result !== undefined ? (
              <Button
                onClick={() =>
                  void copyText(
                    formatNumber(result, { maximumFractionDigits: 6, useGrouping: false }),
                  ).then((ok) => ok && toast(t.tools.calc.copied))
                }
              >
                {t.tools.calc.copy}
              </Button>
            ) : null}
          </>
        }
      />
    </div>
  );
}
