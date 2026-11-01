import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useModuleStates } from '@/core/modules/activation';
import { useFocusSettings } from '@/core/settings/focus';
import { now, today } from '@/core/time/now';
import { t } from '@/strings';
import { Button } from '@/ui';
import { parseCapture, type CaptureFields, type CaptureType } from '../parser';
import { splitCapture } from '../parser/split';
import { useCaptureSettings } from '../settings';
import {
  CaptureError,
  availableTypes,
  saveCapture,
  saveCaptures,
  targetFor,
  type SavedCapture,
} from '../targets';
import { fullFormPath } from '../targets/fullForm';
import { previewChips } from './chips';
import { clearReopenDraft, peekReopenDraft } from './reopen';
import { resolveTarget } from './resolve';
import styles from './CaptureForm.module.css';

export interface CaptureFormProps {
  initialText?: string;
  /** Merged over the parsed fields before saving (e.g. the body of shared text); single entry only. */
  extra?: Partial<CaptureFields>;
  /** Capture window: Tab / Shift+Tab switch the type instead of moving focus. */
  tabSwitchesType?: boolean;
  /** Select the initial text so that typing replaces it (clipboard prefill). */
  selectInitial?: boolean;
  /** Ctrl+Enter: open the module's full form pre-filled (where it supports that). */
  onOpenFull?: (path: string) => void;
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

/**
 * Free-text capture: live parse, type chips, Enter saves. Shared by the app sheet, the share page
 * and the capture window. Text with several lines (or "A, B und C" sentences, see
 * `parser/split.ts`) shows one preview row per entry and saves them all at once; each row is read
 * exactly like the same text typed alone.
 */
export function CaptureForm({
  initialText = '',
  extra,
  tabSwitchesType,
  selectInitial,
  onOpenFull,
  onSaved,
  onCancel,
}: CaptureFormProps) {
  const states = useModuleStates();
  const [settings] = useCaptureSettings();
  const [focus] = useFocusSettings();
  // "Ändern" after a multi-line save puts the text back (see `reopen.ts`).
  const [text, setText] = useState(() => initialText || peekReopenDraft() || '');
  const [override, setOverride] = useState<CaptureType | undefined>();
  // Hand-picked targets of single rows in a multi-line capture, keyed by the row's text.
  const [rowOverride, setRowOverride] = useState<Record<string, CaptureType>>({});
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const parts = useMemo(() => splitCapture(text), [text]);
  const multi = parts.length > 1;
  // One entry: the text as typed (a single line is read exactly as before the split existed).
  const single = parts.length === 1 && text.includes('\n') ? parts[0]! : text;
  const result = useMemo(
    () => parseCapture(single, { now: new Date(now()), defaultType: settings?.defaultType }),
    [single, settings?.defaultType],
  );
  const available = availableTypes(states);
  const resolveOpts = {
    available,
    noQuestion: focus.captureNoQuestion,
    defaultType: settings?.defaultType,
  };
  const resolved = resolveTarget(single, result, { ...resolveOpts, override });
  // No question: text the parser is unsure about goes to the default target (the ToDo inbox) as typed.
  const fallbackType = resolved.inbox ? resolved.type : undefined;
  const type = resolved.type;
  const fields: CaptureFields = { ...resolved.fields, ...extra };
  const chips = previewChips(fields, type, result.notes, today());

  const rows = useMemo(
    () =>
      multi
        ? parts.map((part) => {
            const r = parseCapture(part, {
              now: new Date(now()),
              defaultType: settings?.defaultType,
            });
            const res = resolveTarget(part, r, { ...resolveOpts, override: rowOverride[part] });
            const rowChips = previewChips(res.fields, res.type, r.notes, today()).filter(
              (c) => c.id !== 'target',
            );
            return { part, ...res, chips: rowChips };
          })
        : [],
    // resolveOpts is rebuilt every render from the values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [multi, parts, rowOverride, states, focus.captureNoQuestion, settings?.defaultType],
  );
  const rowsNeedConfirm = rows.some((r) => r.type && targetFor(r.type).requiresConfirm);

  useEffect(() => {
    clearReopenDraft();
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
    if (!value.trim()) {
      setOverride(undefined);
      setRowOverride({});
    }
  };

  const pickRow = (part: string, next: CaptureType) => {
    setRowOverride((o) => ({ ...o, [part]: next }));
    setConfirming(false);
    setError('');
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

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter saves, Shift+Enter starts a new line (one line = one entry); IME composition keeps Enter.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const path =
        (e.ctrlKey || e.metaKey) && !multi && type && onOpenFull
          ? fullFormPath(type, fields, text)
          : undefined;
      if (path) onOpenFull?.(path);
      else submit();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel?.();
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !text.includes('\n')) {
      // With several lines the arrows move the cursor; the rows have their own target menus.
      e.preventDefault();
      cycle(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Tab' && tabSwitchesType && available.length > 1 && !multi) {
      e.preventDefault();
      cycle(e.shiftKey ? -1 : 1);
    }
  };

  const save = async (confirmed: boolean) => {
    if (busy || (!multi && !type)) return;
    setBusy(true);
    try {
      onSaved(
        multi
          ? await saveCaptures(
              rows.map((r) => ({ type: r.type!, fields: r.fields })),
              text,
              { confirmed },
            )
          : await saveCapture(type!, fields, { confirmed }),
      );
      setText('');
      setOverride(undefined);
      setRowOverride({});
      setConfirming(false);
      inputRef.current?.focus();
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
    if (multi) {
      if (rows.some((r) => !r.type)) return setError(t.quickCapture.chooseType);
      // Bookings stay drafts until confirmed, also when they come in a batch.
      if (rowsNeedConfirm && !confirming) return setConfirming(true);
      return void save(true);
    }
    if (!type) return setError(t.quickCapture.chooseType);
    if (targetFor(type).requiresConfirm && !confirming) return setConfirming(true);
    void save(true);
  };

  const rowLabel = (a: CaptureType, kind: CaptureFields['kind']) =>
    a === 'finance' ? t.quickCapture.multi.financeDraft : typeLabel(a, kind);

  return (
    <form
      ref={formRef}
      className={styles.form}
      data-keep-visible
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={inputRef}
        data-autofocus
        className={styles.input}
        value={text}
        rows={Math.min(6, text.split('\n').length)}
        onChange={(e) => change(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t.quickCapture.placeholder}
        aria-label={t.quickCapture.inputLabel}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
      />
      <p className={[styles.hint, styles.lineHint].join(' ')} data-testid="capture-line-hint">
        {t.quickCapture.multi.lineHint}
      </p>

      {multi ? (
        <ul
          className={styles.rows}
          aria-label={t.quickCapture.multi.listLabel(rows.length)}
          aria-live="polite"
          data-testid="capture-rows"
        >
          {rows.map((r, i) => (
            <li key={`${i}-${r.part}`} className={styles.row} data-testid="capture-row">
              <span className={styles.rowTitle}>{r.fields.title || r.part}</span>
              <div className={styles.chips}>
                <select
                  className={styles.rowType}
                  aria-label={t.quickCapture.multi.rowTarget(r.part)}
                  value={r.type ?? ''}
                  onChange={(e) => pickRow(r.part, e.target.value as CaptureType)}
                  data-testid="capture-row-type"
                >
                  {r.type ? null : <option value="">{t.quickCapture.multi.choose}</option>}
                  {available.map((a) => (
                    <option key={a} value={a}>
                      {rowLabel(a, r.fields.kind)}
                    </option>
                  ))}
                </select>
                {r.inbox ? <span className={styles.chip}>{t.quickCapture.multi.inbox}</span> : null}
                {r.chips.map((c) => (
                  <span key={c.id} className={[styles.chip, c.warn ? styles.warn : ''].join(' ')}>
                    {c.label}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.chips} aria-live="polite" data-testid="capture-chips">
          {chips.map((c) => (
            <span key={c.id} className={[styles.chip, c.warn ? styles.warn : ''].join(' ')}>
              {c.label}
            </span>
          ))}
        </div>
      )}

      {available.length === 0 && states ? (
        <p className={styles.hint}>{t.quickCapture.noTargets}</p>
      ) : null}
      {!multi && text.trim() && !type && available.length > 0 ? (
        <p className={styles.hint} role="status">
          {t.quickCapture.chooseType}
        </p>
      ) : null}
      {multi ? (
        <p className={[styles.hint, styles.desktopHint].join(' ')}>
          {t.quickCapture.multi.shiftEnter}
        </p>
      ) : null}
      {!multi && fallbackType ? (
        <p className={styles.hint} role="status" data-testid="capture-inbox-hint">
          {t.quickCapture.inboxHint(t.quickCapture.target[fallbackType])}
        </p>
      ) : null}
      {!multi && onOpenFull && type && fullFormPath(type, fields, text) && text.trim() ? (
        <p className={styles.hint}>{t.quickCapture.fullFormHint}</p>
      ) : null}

      {multi ? null : (
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
      )}

      {confirming && multi ? (
        <div className={styles.draft} data-testid="capture-draft">
          <p className={styles.hint}>{t.quickCapture.financeConfirm}</p>
          {rows
            .filter((r) => r.type && targetFor(r.type).requiresConfirm)
            .map((r, i) => (
              <span key={`${i}-${r.part}`}>
                <strong>{r.chips.find((c) => c.id === 'amount')?.label}</strong> {r.fields.title}
              </span>
            ))}
          <div className={styles.actions}>
            <Button onClick={() => setConfirming(false)}>{t.actions.cancel}</Button>
            <Button variant="primary" onClick={() => void save(true)} data-confirm>
              {t.quickCapture.multi.saveAll(rows.length)}
            </Button>
          </div>
        </div>
      ) : confirming && type ? (
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
          {/* Disabled for the moment module states load: which modules are on is not known yet. */}
          <Button type="submit" variant="primary" disabled={busy || !text.trim() || !states}>
            {multi ? t.quickCapture.multi.saveAll(rows.length) : t.quickCapture.save}
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
