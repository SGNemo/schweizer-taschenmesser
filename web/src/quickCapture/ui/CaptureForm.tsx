import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useFocusSettings } from '@/core/settings/focus';
import { now, today } from '@/core/time/now';
import { t } from '@/strings';
import { Button, Dialog } from '@/ui';
import { parseCapture, type CaptureFields, type CaptureType } from '../parser';
import { splitCapture } from '../parser/split';
import { useCaptureSettings } from '../settings';
import {
  amendCapture,
  CaptureError,
  saveCapture,
  saveCaptures,
  targetFor,
  type CaptureItem,
  type InvoiceLookup,
  type SavedCapture,
} from '../targets';
import { formatDay } from '@/core/time/dates';
import type { CaptureFields as LookupFields } from '../parser';

/** The open-invoice lookup, loaded only when a payment reminder line appears. */
const findOpenInvoice = async (fields: LookupFields, opts: { today: string }) =>
  (await import('../targets/lookup')).findOpenInvoice(fields, opts);
import { fullFormPath } from '../targets/fullForm';
import { announceSaved } from './announceSaved';
import { batchRow, batchTypes, isReminder, reminderRow, withoutPart } from './batch';
import { previewChips } from './chips';
import { clearCaptureDraft, readCaptureDraft, writeCaptureDraft } from './draft';
import { clearReopenDraft, peekReopenDraft, reopenCapture } from './reopen';
import { resolveTarget } from './resolve';
import styles from './CaptureForm.module.css';
import { useCaptureTypes } from './useCaptureTypes';

export interface CaptureFormProps {
  initialText?: string;
  /** Starts with this destination chosen ("create from this mail"); the user can still pick another. */
  initialType?: CaptureType;
  /** Merged over the parsed fields before saving (e.g. the body of shared text); single entry only. */
  extra?: Partial<CaptureFields>;
  /** Capture window: Tab / Shift+Tab switch the type instead of moving focus. */
  tabSwitchesType?: boolean;
  /** Select the initial text so that typing replaces it (clipboard prefill). */
  selectInitial?: boolean;
  /** Keep typed text on the device until the sheet closes, so a killed app gets it back (C04). */
  keepDraft?: boolean;
  /** „Als Ausgabe buchen“ on money lines of a batch; off where no toast can confirm or undo it (capture window). */
  bookChip?: boolean;
  /** Shared text: always one entry, never split into lines or sentences (U17). */
  oneEntry?: boolean;
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
    if (e.code === 'currency') return t.quickCapture.errors.currency(e.detail ?? '');
  }
  return t.quickCapture.errors.failed;
}

/** The error a save would end with, found before a booking is offered for confirmation (X33). */
function buildProblem(type: CaptureType, fields: CaptureFields): string | undefined {
  try {
    targetFor(type).build(fields, { today: today() });
    return undefined;
  } catch (e) {
    return errorText(e);
  }
}

/**
 * Free-text capture: live parse, type chips, Enter saves. Shared by the app sheet, the share page
 * and the capture window. Text with several lines (or "A, B und C" sentences, see
 * `parser/split.ts`) shows one preview row per entry and saves them all at once; each row is read
 * exactly like the same text typed alone.
 */
export function CaptureForm({
  initialText = '',
  initialType,
  extra,
  tabSwitchesType,
  selectInitial,
  keepDraft,
  oneEntry,
  bookChip = true,
  onOpenFull,
  onSaved,
  onCancel,
}: CaptureFormProps) {
  const [settings] = useCaptureSettings();
  // One source for the module states and the types they allow (a second query could lag behind).
  const { states, available, fitness } = useCaptureTypes();
  const [focus] = useFocusSettings();
  // "Ändern" after a multi-line save puts the text back (see `reopen.ts`).
  // A text kept from an app the phone killed mid-typing comes back too (C04, `draft.ts`).
  const [text, setText] = useState(
    () => initialText || peekReopenDraft() || (keepDraft ? readCaptureDraft() : undefined) || '',
  );
  const [override, setOverride] = useState<CaptureType | undefined>(initialType);
  // Hand-picked targets of single rows in a multi-line capture, keyed by the row's text.
  const [rowOverride, setRowOverride] = useState<Record<string, CaptureType>>({});
  const [confirming, setConfirming] = useState(false);
  // „Als Ausgabe buchen“ on a line of a batch: that line in the single sheet, on top of this one.
  const [booking, setBooking] = useState<{ part: string; label: string } | undefined>();
  // The row whose target choice is open (rows show their target as text; a tap opens the choice).
  const [choosing, setChoosing] = useState<string | undefined>();
  // Open-invoice lookups of payment reminder lines, keyed by the line (`findOpenInvoice`).
  const [lookups, setLookups] = useState<Record<string, InvoiceLookup | null>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // The booking toast outlives the sheet: its undo must know whether the sheet is still there.
  const mounted = useRef(true);
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const formRef = useRef<HTMLFormElement>(null);

  const parts = useMemo(() => (oneEntry ? [text] : splitCapture(text)), [text, oneEntry]);
  const multi = parts.length > 1;
  // One entry: the text as typed (a single line is read exactly as before the split existed).
  const single = parts.length === 1 && text.includes('\n') && !oneEntry ? parts[0]! : text;
  const result = useMemo(
    () =>
      parseCapture(single, { now: new Date(now()), defaultType: settings?.defaultType, fitness }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fitness` is rebuilt per render; its two flags are the deps
    [single, settings?.defaultType, fitness.meal, fitness.workout],
  );
  const resolveOpts = {
    available,
    noQuestion: focus.captureNoQuestion,
    defaultType: settings?.defaultType,
  };
  const resolved = resolveTarget(single, result, { ...resolveOpts, override });
  // No question: text the parser is unsure about goes to the default target (the ToDo inbox) as typed.
  const fallbackType = resolved.inbox ? resolved.type : undefined;
  const singleFields: CaptureFields = { ...resolved.fields, ...extra };
  // The single sheet treats a payment reminder the same way as a line of a batch.
  const singlePlan = reminderRow(
    resolved.type,
    singleFields,
    multi ? undefined : (lookups[single] ?? undefined),
    available,
  );
  const type = singlePlan.type;
  const fields = singlePlan.fields;
  const chips = previewChips(fields, type, result.notes, today());

  const rows = useMemo(
    () =>
      multi
        ? parts.map((part) => {
            const r = parseCapture(part, {
              now: new Date(now()),
              defaultType: settings?.defaultType,
              fitness,
            });
            const res = resolveTarget(part, r, { ...resolveOpts, override: rowOverride[part] });
            // A batch never books: a money line becomes a ToDo with its amount (Q1 a).
            const row = batchRow(res.type, res.fields, available, r.type, res.inbox);
            // A payment reminder: noted on its open invoice, a ToDo „… prüfen“, or a new invoice.
            const reminder = isReminder(row.type, row.fields);
            const plan = reminderRow(row.type, row.fields, lookups[part] ?? undefined, available);
            const rowChips = previewChips(plan.fields, plan.type, r.notes, today()).filter(
              (c) => c.id !== 'target',
            );
            return { part, ...res, ...row, ...plan, reminder, source: row.fields, chips: rowChips };
          })
        : [],
    // resolveOpts is rebuilt every render from the values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      multi,
      parts,
      rowOverride,
      lookups,
      states,
      focus.captureNoQuestion,
      settings?.defaultType,
      fitness.meal,
      fitness.workout,
    ],
  );
  const rowTypes = batchTypes(available);

  // Reminder lines look for their open invoice while the person types; the result only changes text.
  const reminderKeys = (
    multi
      ? rows.filter((r) => r.reminder).map((r) => r.part)
      : isReminder(resolved.type, singleFields)
        ? [single]
        : []
  ).filter((k) => !(k in lookups));
  const reminderKey = reminderKeys.join('\n');
  useEffect(() => {
    if (!reminderKey) return;
    let live = true;
    void (async () => {
      const found: Record<string, InvoiceLookup | null> = {};
      for (const key of reminderKey.split('\n')) {
        const r = parseCapture(key, { now: new Date(now()), defaultType: settings?.defaultType });
        found[key] =
          (await findOpenInvoice(r.fields, { today: today() }).catch(() => undefined)) ?? null;
      }
      if (live) setLookups((cur) => ({ ...cur, ...found }));
    })();
    return () => {
      live = false;
    };
  }, [reminderKey, settings?.defaultType]);
  // A typed date that does not exist ("31.11."): the adapters would fall back to today, so the
  // entry is incomplete until the date is fixed (X20).
  const badDate = (list: readonly { id: string }[]) =>
    list.some((c) => c.id === 'note-invalid-date');

  useEffect(() => {
    clearReopenDraft();
    inputRef.current?.focus();
    if (selectInitial) inputRef.current?.select();
  }, [selectInitial]);

  // Closing the sheet (or saving, below) ends the draft; a killed app never gets here.
  useEffect(() => (keepDraft ? clearCaptureDraft : undefined), [keepDraft]);

  useEffect(() => {
    if (confirming) formRef.current?.querySelector<HTMLElement>('[data-confirm]')?.focus();
  }, [confirming]);

  const change = (value: string) => {
    setText(value);
    if (keepDraft) writeCaptureDraft(value);
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

  /** The batch as saved: reminder lines are looked up once more, so a settled invoice is never noted. */
  const batchItems = async (): Promise<CaptureItem[]> =>
    Promise.all(
      rows.map(async (r): Promise<CaptureItem> => {
        if (!r.reminder) return { type: r.type!, fields: r.fields };
        const lookup = await findOpenInvoice(r.source, { today: today() }).catch(() => undefined);
        const plan = reminderRow('invoice', r.source, lookup, available);
        if (!plan.type) throw new CaptureError('invalid');
        return { type: plan.type, fields: plan.fields, amend: plan.amend, fallback: plan.fallback };
      }),
    );

  // `confirmed` only for the single sheet, after „Buchen“; a batch never passes it (and never books).
  const save = async (confirmed: boolean) => {
    if (busy || (!multi && !type)) return;
    setBusy(true);
    try {
      onSaved(
        multi
          ? await saveCaptures(await batchItems(), text)
          : singlePlan.amend
            ? await amendCapture(type!, fields, singlePlan.amend).catch((e: unknown) => {
                if (e instanceof CaptureError && e.code === 'stale' && singlePlan.fallback)
                  return saveCapture(singlePlan.fallback.type, singlePlan.fallback.fields);
                throw e;
              })
            : await saveCapture(type!, fields, { confirmed }),
      );
      setText('');
      if (keepDraft) clearCaptureDraft();
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
      if (rows.some((r) => badDate(r.chips))) return setError(t.quickCapture.errors.invalid);
      // One tap saves the batch; nothing in it books, so nothing asks for a confirmation (U04).
      return void save(false);
    }
    if (!type) return setError(t.quickCapture.chooseType);
    if (badDate(chips)) return setError(t.quickCapture.errors.invalid);
    if (targetFor(type).requiresConfirm && !confirming) {
      const problem = buildProblem(type, fields);
      return problem ? setError(problem) : setConfirming(true);
    }
    void save(true);
  };

  /** „ToDo“, „Rechnung · 13. Okt. · Datum angenommen“, „Mahnung zu Rechnung … · vermerken“. */
  const rowTargetText = (r: (typeof rows)[number]): string => {
    if (r.amend)
      return t.quickCapture.multi.dunningMatch(r.amend.payee, formatDay(r.amend.dueDate, 'd.M.'));
    if (!r.type) return t.quickCapture.multi.choose;
    return [
      typeLabel(r.type, r.fields.kind),
      ...(r.inbox ? [t.quickCapture.multi.inbox] : []),
      ...r.chips.map((c) => c.label),
    ].join(' · ');
  };

  return (
    <>
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
        {multi ? (
          // Several lines: the calm promise, on every device (U01).
          <p className={styles.hint} data-testid="capture-line-hint">
            {t.quickCapture.multi.calmHint}
          </p>
        ) : (
          <p className={[styles.hint, styles.lineHint].join(' ')} data-testid="capture-line-hint">
            {t.quickCapture.multi.lineHint}
          </p>
        )}

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
                  {choosing === r.part ? (
                    <select
                      className={styles.rowType}
                      aria-label={t.quickCapture.multi.rowTarget(r.part)}
                      value={r.type ?? ''}
                      autoFocus
                      onChange={(e) => {
                        pickRow(r.part, e.target.value as CaptureType);
                        setChoosing(undefined);
                      }}
                      onBlur={() => setChoosing(undefined)}
                      data-testid="capture-row-type"
                    >
                      {r.type ? null : <option value="">{t.quickCapture.multi.choose}</option>}
                      {rowTypes.map((a) => (
                        <option key={a} value={a}>
                          {typeLabel(a, r.fields.kind)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    // The target as words; a tap opens the choice (no select in the first view).
                    <button
                      type="button"
                      className={styles.rowTarget}
                      aria-label={`${t.quickCapture.multi.rowTarget(r.part)}: ${rowTargetText(r)}`}
                      onClick={() => setChoosing(r.part)}
                      data-testid="capture-row-target"
                      data-type={r.type ?? ''}
                    >
                      {rowTargetText(r)}
                    </button>
                  )}
                  {r.booking && bookChip
                    ? (() => {
                        const label =
                          r.booking === 'income'
                            ? t.quickCapture.multi.bookIncome
                            : t.quickCapture.multi.bookExpense;
                        return (
                          <button
                            type="button"
                            className={[styles.chip, styles.chipAction].join(' ')}
                            aria-label={t.quickCapture.multi.bookLine(label, r.part)}
                            onClick={() => setBooking({ part: r.part, label })}
                            data-testid="capture-row-book"
                          >
                            {label}
                          </button>
                        );
                      })()
                    : null}
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

        {confirming && type && !multi ? (
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
      {booking !== undefined ? (
        // The single sheet with the line: draft and „Buchen“ as always; booked, the line leaves the batch.
        <Dialog open onClose={() => setBooking(undefined)} title={booking.label} size="roomy">
          <CaptureForm
            initialText={booking.part}
            initialType="finance"
            onCancel={() => setBooking(undefined)}
            onSaved={(saved) => {
              const { part } = booking;
              setBooking(undefined);
              change(withoutPart(text, part));
              // „Rückgängig“ takes the booking back and puts the line back into the batch.
              void announceSaved({
                ...saved,
                undo: async () => {
                  await saved.undo();
                  // The sheet is gone: the line comes back in a fresh one, never lost.
                  if (!mounted.current) return reopenCapture(part);
                  const cur = textRef.current;
                  change(cur.trim() ? `${cur}\n${part}` : part);
                },
              });
              inputRef.current?.focus();
            }}
          />
        </Dialog>
      ) : null}
    </>
  );
}
