/**
 * "Startdaten einrichten": choose a way (text, file, templates, form), see a preview with ticks and
 * duplicate flags, confirm – only then anything is stored, as one batch that can be undone.
 */
import { useEffect, useRef, useState } from 'react';
import type { ModuleManifest } from '@/core/modules/types';
import { pickTextFile } from '@/core/io/pickFile';
import { today } from '@/core/time/now';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Badge, Button, Checkbox, Dialog, HelpHint, SelectField, TextArea, TextField } from '@/ui';
import {
  commitImport,
  countRecords,
  markOnboardingHandled,
  newBatchId,
  undoImport,
  useImportBatches,
} from './batches';
import { buildPreview, ImportError } from './plan';
import type {
  Choice,
  ImportBatch,
  ImportField,
  ImporterMeta,
  ImporterRuntime,
  PreviewRow,
} from './types';
import styles from './OnboardingWizard.module.css';

type Step = 'choose' | 'input' | 'preview' | 'done';

export function hasImporters(manifest: ModuleManifest): boolean {
  return (manifest.contributions?.onboarding?.importers ?? []).some((i) => i.kind !== 'connector');
}

export function OnboardingWizard({
  manifest,
  open,
  onClose,
}: {
  manifest: ModuleManifest;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={t.onboarding.title(manifest.name)}>
      <Wizard manifest={manifest} onClose={onClose} />
    </Dialog>
  );
}

function errorText(e: unknown): string {
  if (e instanceof ImportError) return t.onboarding.errors[e.code] ?? t.onboarding.errors.fallback!;
  if (e instanceof Error && e.message === 'file-too-large') return t.onboarding.fileTooLarge;
  return t.onboarding.errors.fallback!;
}

function FieldInput({
  field,
  value,
  onChange,
  choices,
}: {
  field: ImportField;
  value: string;
  onChange: (value: string) => void;
  choices: Choice[];
}) {
  if (field.type === 'select') {
    const options = field.dynamicChoices ? choices : (field.choices ?? []);
    return (
      <SelectField
        label={field.label}
        hint={field.hint}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </SelectField>
    );
  }
  return (
    <TextField
      label={field.label}
      hint={field.hint}
      type={field.type === 'text' ? 'text' : field.type}
      value={value}
      placeholder={field.placeholder}
      required={field.required}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Wizard({ manifest, onClose }: { manifest: ModuleManifest; onClose: () => void }) {
  const toast = useUiStore((s) => s.toast);
  const importers = (manifest.contributions?.onboarding?.importers ?? []).filter(
    (i) => i.kind !== 'connector',
  );
  const batches = useImportBatches(manifest.id);

  const [step, setStep] = useState<Step>('choose');
  const [importer, setImporter] = useState<ImporterMeta | null>(null);
  const [runtime, setRuntime] = useState<ImporterRuntime | null>(null);
  const [options, setOptions] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, Choice[]>>({});
  const [text, setText] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [ticked, setTicked] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ImportBatch | null>(null);
  const batchId = useRef(newBatchId());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function choose(meta: ImporterMeta) {
    setError('');
    setBusy(true);
    try {
      const rt = (await manifest.contributions!.onboarding!.load!()).default;
      const defaults: Record<string, string> = {};
      const dynamic: Record<string, Choice[]> = {};
      for (const field of [...(meta.options ?? []), ...(meta.fields ?? [])]) {
        if (field.defaultValue) defaults[field.key] = field.defaultValue;
        if (field.dynamicChoices && rt.optionChoices) {
          dynamic[field.key] = await rt.optionChoices(field.key);
          defaults[field.key] = dynamic[field.key]![0]?.value ?? '';
        }
        if (field.type === 'select' && !field.dynamicChoices && !defaults[field.key])
          defaults[field.key] = field.choices?.[0]?.value ?? '';
      }
      if (!alive.current) return;
      setRuntime(rt);
      setChoices(dynamic);
      setOptions(
        Object.fromEntries((meta.options ?? []).map((f) => [f.key, defaults[f.key] ?? ''])),
      );
      setValues(Object.fromEntries((meta.fields ?? []).map((f) => [f.key, defaults[f.key] ?? ''])));
      setTicked((meta.templates ?? []).filter((tpl) => tpl.preselected).map((tpl) => tpl.id));
      setText('');
      setFileName('');
      setImporter(meta);
      setStep('input');
    } catch (e) {
      setError(errorText(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function runParse(input: Parameters<ImporterRuntime['parse']>[1]) {
    if (!importer || !runtime) return;
    setError('');
    setBusy(true);
    try {
      const result = await runtime.parse(importer.id, input, {
        today: today(),
        options,
        batchId: batchId.current,
      });
      if (!alive.current) return;
      if (result.candidates.length === 0) {
        setNotes(result.notes);
        setError(result.notes.length === 0 ? t.onboarding.nothingFound : '');
        return;
      }
      setRows(await buildPreview(manifest, runtime, result.candidates));
      setNotes(result.notes);
      setStep('preview');
    } catch (e) {
      setError(errorText(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function chooseFile() {
    if (!importer) return;
    setError('');
    try {
      const file = await pickTextFile(importer.accept ?? '*/*');
      if (!file) return;
      setFileName(file.name);
      await runParse({ kind: 'file', text: file.text, fileName: file.name });
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'file-too-large'
          ? t.onboarding.fileTooLarge
          : t.onboarding.readError,
      );
    }
  }

  async function submitInput() {
    if (!importer) return;
    if (importer.kind === 'text') {
      if (!text.trim()) return setError(t.onboarding.noInput);
      await runParse({ kind: 'text', text });
    } else if (importer.kind === 'template') {
      if (ticked.length === 0) return setError(t.onboarding.noInput);
      await runParse({ kind: 'template', ids: ticked });
    } else if (importer.kind === 'form') {
      await runParse({ kind: 'form', values });
    }
  }

  async function confirm() {
    if (!importer) return;
    setBusy(true);
    setError('');
    try {
      const batch = await commitImport(manifest, {
        batchId: batchId.current,
        importerId: importer.id,
        source: fileName || importer.label,
        rows,
      });
      await markOnboardingHandled(manifest.id);
      batchId.current = newBatchId();
      if (!alive.current) return;
      setDone(batch);
      setStep('done');
    } catch (e) {
      setError(errorText(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function undo(batchToUndo: string) {
    const { removed, kept } = await undoImport(manifest, batchToUndo);
    toast(t.onboarding.undone(removed, kept));
    if (done?.id === batchToUndo) onClose();
  }

  async function skip() {
    await markOnboardingHandled(manifest.id);
    onClose();
  }

  const selectedCount = rows.filter((r) => r.selected && !r.invalid).length;

  if (step === 'choose') {
    return (
      <div className={styles.stack}>
        <p className={styles.lead}>
          {t.onboarding.chooseIntro} <HelpHint text={t.help.startData} label={t.help.label} />
        </p>
        <ul className={styles.choices}>
          {importers.map((meta) => (
            <li key={meta.id}>
              <button
                type="button"
                className={styles.choice}
                disabled={busy}
                onClick={() => void choose(meta)}
              >
                <span className={styles.choiceTitle}>{meta.label}</span>
                {meta.description ? <span className={styles.muted}>{meta.description}</span> : null}
              </button>
            </li>
          ))}
        </ul>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {batches && batches.length > 0 ? (
          <section className={styles.recent} aria-label={t.onboarding.recent}>
            <h3>{t.onboarding.recent}</h3>
            {batches.slice(0, 5).map((b) => (
              <div key={b.id} className={styles.recentRow}>
                <span className={styles.muted}>
                  {t.onboarding.recentEntry(
                    b.source,
                    countRecords(b),
                    formatDay(new Date(b.createdAt).toISOString().slice(0, 10), 'd. MMM yyyy'),
                  )}
                </span>
                {b.undoneAt ? (
                  <Badge>{t.onboarding.recentUndone}</Badge>
                ) : (
                  <Button onClick={() => void undo(b.id)}>{t.onboarding.undo}</Button>
                )}
              </div>
            ))}
          </section>
        ) : null}
        <div className={styles.bar}>
          <span className={styles.muted}>{t.onboarding.skipHint}</span>
          <Button onClick={() => void skip()}>{t.onboarding.skip}</Button>
        </div>
      </div>
    );
  }

  if (step === 'input' && importer) {
    const fieldsFor = (
      list: ImportField[],
      state: Record<string, string>,
      set: (v: Record<string, string>) => void,
    ) =>
      list.map((f) => (
        <FieldInput
          key={f.key}
          field={f}
          value={state[f.key] ?? ''}
          choices={choices[f.key] ?? []}
          onChange={(v) => set({ ...state, [f.key]: v })}
        />
      ));
    return (
      <div className={styles.stack}>
        <h3>{importer.label}</h3>
        {importer.description ? <p className={styles.lead}>{importer.description}</p> : null}
        {(importer.options?.length ?? 0) > 0 ? (
          <div className={styles.fields}>{fieldsFor(importer.options!, options, setOptions)}</div>
        ) : null}
        {importer.kind === 'text' ? (
          <TextArea
            label={t.onboarding.textLabel}
            rows={8}
            value={text}
            placeholder={importer.placeholder}
            data-autofocus
            onChange={(e) => setText(e.target.value)}
          />
        ) : null}
        {importer.kind === 'template' ? (
          <fieldset className={styles.fields} style={{ border: 0, padding: 0, margin: 0 }}>
            <legend>{t.onboarding.pickTemplates}</legend>
            {importer.templates!.map((tpl) => (
              <Checkbox
                key={tpl.id}
                checked={ticked.includes(tpl.id)}
                onChange={(e) =>
                  setTicked(
                    e.target.checked ? [...ticked, tpl.id] : ticked.filter((id) => id !== tpl.id),
                  )
                }
                label={
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{tpl.label}</span>
                    {tpl.detail ? <span className={styles.muted}>{tpl.detail}</span> : null}
                  </span>
                }
              />
            ))}
          </fieldset>
        ) : null}
        {importer.kind === 'form' ? (
          <div className={styles.fields}>{fieldsFor(importer.fields!, values, setValues)}</div>
        ) : null}
        {importer.kind === 'file' ? (
          <div className={styles.bar}>
            <Button variant="primary" disabled={busy} onClick={() => void chooseFile()}>
              {t.onboarding.chooseFile}
            </Button>
            {fileName ? (
              <span className={styles.muted}>{t.onboarding.fileChosen(fileName)}</span>
            ) : null}
          </div>
        ) : null}
        {notes.length > 0 ? (
          <ul className={styles.notes}>
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.bar}>
          <Button onClick={() => setStep('choose')}>{t.onboarding.back}</Button>
          {importer.kind !== 'file' ? (
            <Button variant="primary" disabled={busy} onClick={() => void submitInput()}>
              {busy ? t.onboarding.parsing : t.onboarding.preview}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (step === 'preview') {
    const allSelected = rows.every((r) => r.invalid || r.selected);
    return (
      <div className={styles.stack}>
        <p className={styles.lead}>{t.onboarding.previewIntro}</p>
        <div className={styles.bar}>
          <strong>{t.onboarding.found(rows.length)}</strong>
          <Button
            onClick={() =>
              setRows(rows.map((r) => ({ ...r, selected: !r.invalid && !allSelected })))
            }
          >
            {allSelected ? t.onboarding.selectNone : t.onboarding.selectAll}
          </Button>
        </div>
        <ul className={styles.rows} aria-label={t.onboarding.previewTitle}>
          {rows.map((r) => (
            <li key={r.index} className={styles.row}>
              <Checkbox
                checked={r.selected}
                disabled={Boolean(r.invalid)}
                onChange={(e) =>
                  setRows(
                    rows.map((x) =>
                      x.index === r.index ? { ...x, selected: e.target.checked } : x,
                    ),
                  )
                }
                label={
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{r.candidate.label}</span>
                    {r.candidate.detail ? (
                      <span className={styles.muted}>{r.candidate.detail}</span>
                    ) : null}
                    {r.duplicate || r.invalid || r.candidate.warning ? (
                      <span className={styles.badges}>
                        {r.duplicate ? <Badge>{t.onboarding.duplicate}</Badge> : null}
                        {r.invalid ? <Badge>{t.onboarding.invalid}</Badge> : null}
                        {r.candidate.warning ? <Badge>{r.candidate.warning}</Badge> : null}
                      </span>
                    ) : null}
                  </span>
                }
              />
            </li>
          ))}
        </ul>
        {notes.length > 0 ? (
          <ul className={styles.notes}>
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.bar}>
          <Button onClick={() => setStep('input')}>{t.onboarding.back}</Button>
          <Button
            variant="primary"
            disabled={busy || selectedCount === 0}
            onClick={() => void confirm()}
          >
            {busy ? t.onboarding.importing : t.onboarding.importN(selectedCount)}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <p role="status">{done ? t.onboarding.imported(countRecords(done)) : null}</p>
      <div className={styles.bar}>
        {done ? <Button onClick={() => void undo(done.id)}>{t.onboarding.undo}</Button> : <span />}
        <Button variant="primary" data-autofocus onClick={onClose}>
          {t.onboarding.close}
        </Button>
      </div>
    </div>
  );
}
