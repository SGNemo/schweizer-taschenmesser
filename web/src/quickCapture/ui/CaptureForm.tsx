import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useModuleStates } from '@/core/modules/activation';
import { now, today } from '@/core/time/now';
import { t } from '@/strings';
import { Button } from '@/ui';
import { parseCapture, type CaptureFields, type CaptureType } from '../parser';
import { useCaptureSettings } from '../settings';
import {
  CaptureError,
  availableTypes,
  saveCapture,
  targetFor,
  type SavedCapture,
} from '../targets';
import { previewChips } from './chips';
import styles from './CaptureForm.module.css';

export interface CaptureFormProps {
  initialText?: string;
  /** Merged over the parsed fields before saving (e.g. the body of shared text). */
  extra?: Partial<CaptureFields>;
  /** Capture window: Tab / Shift+Tab switch the type instead of moving focus. */
  tabSwitchesType?: boolean;
  /** Select the initial text so that typing replaces it (clipboard prefill). */
  selectInitial?: boolean;
  onSaved: (saved: SavedCapture) => void;
  onCancel?: () => void;
}

const typeLabel = (type: CaptureType, kind: CaptureFields['kind']): string =>
  t.quickCapture.type[type === 'finance' && kind === 'income' ? 'income' : type];

function errorText(e: unknown): string {
  if (e instanceof CaptureError) {
    if (e.code === 'module-off') return t.quickCapture.errors.moduleOff(e.detail ?? '');
    if (e.code === 'invalid') return t.quickCapture.errors.invalid;
  }
  return t.quickCapture.errors.failed;
}

/** Free-text capture: live parse, type chips, Enter saves. Shared by the app sheet, the share page and the capture window. */
export function CaptureForm({
  initialText = '',
  extra,
  tabSwitchesType,
  selectInitial,
  onSaved,
  onCancel,
}: CaptureFormProps) {
  const states = useModuleStates();
  const [settings] = useCaptureSettings();
  const [text, setText] = useState(initialText);
  const [override, setOverride] = useState<CaptureType | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const result = useMemo(
    () => parseCapture(text, { now: new Date(now()), defaultType: settings?.defaultType }),
    [text, settings?.defaultType],
  );
  const available = availableTypes(states);
  const wanted = override ?? (result.needsChoice ? undefined : result.type);
  const type = wanted && available.includes(wanted) ? wanted : undefined;
  const fields: CaptureFields = { ...result.fields, ...extra };
  const chips = previewChips(fields, type, result.notes, today());

  useEffect(() => {
    inputRef.current?.focus();
    if (selectInitial) inputRef.current?.select();
  }, [selectInitial]);

  useEffect(() => {
    if (confirming) formRef.current?.querySelector<HTMLElement>('[data-confirm]')?.focus();
  }, [confirming]);

  const change = (value: string) => {
    setText(value);
    setConfirming(false);
    setError('');
    // A new prefix or a cleared field starts over; otherwise the user's manual choice sticks.
    if (!value.trim()) setOverride(undefined);
  };

  const pick = (next: CaptureType) => {
    setOverride(next);
    setConfirming(false);
    setError('');
    // Back to the field so Enter saves right after a mouse pick.
    inputRef.current?.focus();
  };

  const cycle = (step: 1 | -1) => {
    if (available.length === 0) return;
    const i = type ? available.indexOf(type) : step === 1 ? -1 : 0;
    pick(available[(i + step + available.length) % available.length]!);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel?.();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      cycle(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Tab' && tabSwitchesType && available.length > 1) {
      e.preventDefault();
      cycle(e.shiftKey ? -1 : 1);
    }
  };

  const save = async (confirmed: boolean) => {
    if (!type || busy) return;
    setBusy(true);
    try {
      onSaved(await saveCapture(type, fields, { confirmed }));
      setText('');
      setOverride(undefined);
      setConfirming(false);
    } catch (e) {
      setError(errorText(e));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    // Module states are still loading: which modules are on is not known yet, so do not guess.
    if (!states) return;
    if (!text.trim()) return setError(t.quickCapture.empty);
    if (!type) return setError(t.quickCapture.chooseType);
    if (targetFor(type).requiresConfirm && !confirming) return setConfirming(true);
    void save(true);
  };

  return (
    <form
      ref={formRef}
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        ref={inputRef}
        data-autofocus
        className={styles.input}
        value={text}
        onChange={(e) => change(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t.quickCapture.placeholder}
        aria-label={t.quickCapture.inputLabel}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
      />

      <div className={styles.chips} aria-live="polite" data-testid="capture-chips">
        {chips.map((c) => (
          <span key={c.id} className={[styles.chip, c.warn ? styles.warn : ''].join(' ')}>
            {c.label}
          </span>
        ))}
      </div>

      {available.length === 0 && states ? (
        <p className={styles.hint}>{t.quickCapture.noTargets}</p>
      ) : null}
      {text.trim() && !type && available.length > 0 ? (
        <p className={styles.hint} role="status">
          {t.quickCapture.chooseType}
        </p>
      ) : null}

      <div className={styles.types} role="radiogroup" aria-label={t.quickCapture.title}>
        {available.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={a === type}
            tabIndex={tabSwitchesType ? -1 : 0}
            className={styles.type}
            onClick={() => pick(a)}
          >
            {typeLabel(a, fields.kind)}
          </button>
        ))}
      </div>

      {confirming && type ? (
        <div className={styles.draft} data-testid="capture-draft">
          <p className={styles.hint}>{t.quickCapture.financeConfirm}</p>
          <strong>{chips.find((c) => c.id === 'amount')?.label}</strong>
          <span>{fields.title}</span>
          <div className={styles.actions}>
            <Button onClick={() => setConfirming(false)}>{t.actions.cancel}</Button>
            <Button variant="primary" onClick={() => void save(true)} data-confirm>
              {t.quickCapture.book}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          {onCancel ? <Button onClick={onCancel}>{t.actions.cancel}</Button> : null}
          <Button type="submit" variant="primary" disabled={busy || !text.trim()}>
            {t.quickCapture.save}
          </Button>
        </div>
      )}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
