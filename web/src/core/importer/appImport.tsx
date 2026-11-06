/**
 * "Umzug von einer anderen App" – one sheet: where from (tiles, text + icon, no brand logos) → files
 * (ZIP too, unpacked in a Worker) → what was recognised, with reason, certainty and counts → the
 * existing preview/undo wizard per target module → after a run with several parts its summary with
 * "undo the whole run". No own preview and no own write path: everything after the recognition is
 * the generic flow. Nothing leaves the device; the vault's CSV only opens the vault's own import.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { enableModule, useModuleStates } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { importersOf } from '@/core/dataapi/onboarding';
import { pickRawFiles } from '@/core/io/pickFile';
import { chooseOrigin, type Origin } from '@/core/setup/migrate';
import { detectSources, SOURCES } from '@/importers/registry';
import { isAbort, runJob } from '@/importers/run';
import type { Detection, SourceDef, SourceFile, SourceSummary } from '@/importers/types';

import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Badge, Button, Dialog, EmptyState, HeadSurface, Icon, type IconName } from '@/ui';
import { SignatureMark } from '@/ui/identity';
import { newBatchId } from './batches';
import { useAppImport } from './appImportStore';
import { useOnboardingHost, type HostItem } from './host';
import { undoRun, useImportRun } from './runs';
import styles from './AppImport.module.css';

/** Relevant files per source: those the source itself recognises. */
const filesOf = (source: SourceDef, files: readonly SourceFile[]) =>
  files.filter((f) => source.detect([f]) >= 0.3);

/** Task sources: one list per project/list of the source instead of "everything into one list". */
const PER_SOURCE_LIST: Record<string, Record<string, string>> = {
  todos: { fileList: '@source' },
};

/**
 * The wizard runs for the chosen sources: one per module and importer for importers that take
 * several files (notes, tasks), one per file for the others (a calendar file, a bank statement).
 * Exported for tests.
 */
export function planRuns(
  sources: SourceDef[],
  files: SourceFile[],
  binary: number,
  groupId: string,
  source: string,
): HostItem[] {
  const items: HostItem[] = [];
  const merged = new Map<string, HostItem>();
  for (const src of sources) {
    const relevant = filesOf(src, files);
    for (const target of src.targets) {
      if (!target.importerId || relevant.length === 0) continue;
      const manifest = getManifest(target.moduleId);
      const meta = manifest && importersOf(manifest).find((i) => i.id === target.importerId);
      if (!meta) continue;
      const options = PER_SOURCE_LIST[target.moduleId];
      if (meta.multiple) {
        const key = `${target.moduleId}|${target.importerId}`;
        const item = merged.get(key) ?? {
          moduleId: target.moduleId,
          preset: {
            importerId: target.importerId,
            files: [],
            binary,
            groupId,
            source,
            ...(options ? { options } : {}),
          },
        };
        for (const f of relevant)
          if (!item.preset!.files.some((x) => x.name === f.name)) item.preset!.files.push(f);
        if (!merged.has(key)) {
          merged.set(key, item);
          items.push(item);
        }
      } else {
        for (const f of relevant)
          items.push({
            moduleId: target.moduleId,
            preset: {
              importerId: target.importerId,
              files: [f],
              groupId,
              // The archive or file the person chose, not a path inside it (the run's label).
              source,
              ...(options ? { options } : {}),
            },
          });
      }
    }
  }
  return items;
}

/** The origin tiles. `migrate` feeds the setup checklist ("Was fehlt noch"); ids only. */
export const ORIGIN_TILES: readonly { id: string; icon: IconName; migrate?: Origin }[] = [
  { id: 'google', icon: 'globe', migrate: 'google' },
  { id: 'apple', icon: 'monitor' },
  { id: 'microsoft', icon: 'mail', migrate: 'microsoft' },
  { id: 'todoist', icon: 'checklist', migrate: 'todoist' },
  { id: 'ticktick', icon: 'check' },
  { id: 'notion', icon: 'files' },
  { id: 'evernote', icon: 'note', migrate: 'evernote' },
  { id: 'obsidian', icon: 'text', migrate: 'obsidian' },
  { id: 'bank', icon: 'wallet', migrate: 'bank' },
  { id: 'passwords', icon: 'lock', migrate: 'bitwarden' },
  { id: 'browser', icon: 'bookmark' },
  { id: 'other', icon: 'help' },
];

type OriginId = (typeof ORIGIN_TILES)[number]['id'];

/** Certainty as words; never only a number or a colour. */
export function certainty(confidence: number): 'sure' | 'likely' | 'maybe' {
  return confidence >= 0.9 ? 'sure' : confidence >= 0.6 ? 'likely' : 'maybe';
}

/** "3 Projekte · 214 Aufgaben" – the counts a source reported, in a fixed order. */
export function summaryLine(summary: SourceSummary | undefined): string {
  if (!summary) return '';
  const units = t.importers.units;
  return (Object.keys(units) as (keyof typeof units)[])
    .filter((unit) => (summary[unit] ?? 0) > 0)
    .map((unit) => units[unit](summary[unit]!))
    .join(' · ');
}

const sourceName = (id: string) =>
  t.importers.sources[id as keyof typeof t.importers.sources] ?? id;

type Phase = 'where' | 'files' | 'reading' | 'found';

export function AppImportHost() {
  const { open, runId, close } = useAppImport();
  if (!open) return null;
  return (
    <Dialog open onClose={close} title={t.importers.title}>
      {runId ? <RunSummary groupId={runId} onClose={close} /> : <AppImport onClose={close} />}
    </Dialog>
  );
}

function Head({ step }: { step: 1 | 2 | 3 }) {
  const s = t.importers.steps;
  const steps = [s.where, s.files, s.check];
  return (
    <HeadSurface as="section" size="compact" className={styles.head} aria-label={s.label}>
      <span className={styles.mark}>
        <SignatureMark id="arrowProgress" size={40} />
      </span>
      <span className={styles.headText}>
        <span className={styles.headTitle}>{t.importers.stepOf(step, steps.length)}</span>
        <ol className={styles.steps}>
          {steps.map((label, i) => (
            <li key={label} aria-current={i + 1 === step ? 'step' : undefined}>
              {label}
            </li>
          ))}
        </ol>
      </span>
    </HeadSurface>
  );
}

function AppImport({ onClose }: { onClose: () => void }) {
  const text = t.importers;
  const navigate = useNavigate();
  const startQueue = useOnboardingHost((h) => h.openQueue);
  const states = useModuleStates();
  const [phase, setPhase] = useState<Phase>('where');
  const [origin, setOrigin] = useState<OriginId | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [abort, setAbort] = useState<AbortController | null>(null);
  const [read, setRead] = useState<{ files: SourceFile[]; binary: number; name: string } | null>(
    null,
  );
  const [found, setFound] = useState<(Detection & { counts: string })[]>([]);
  const [manual, setManual] = useState(false);

  async function launch(sources: SourceDef[]) {
    if (!read) return;
    // A source that lives behind the vault password opens the vault's own import.
    const route = sources.flatMap((s) => s.targets).find((tg) => tg.route)?.route;
    // Only a move that really starts feeds the setup checklist ("Was fehlt noch").
    const migrate = ORIGIN_TILES.find((o) => o.id === origin)?.migrate;
    const runs = planRuns(sources, read.files, read.binary, newBatchId(), read.name);
    if (runs.length === 0 && route) {
      if (migrate) await chooseOrigin(migrate).catch(() => {});
      onClose();
      void navigate(route);
      return;
    }
    if (runs.length === 0) return setError(text.nothing);
    if (migrate) await chooseOrigin(migrate).catch(() => {});
    for (const run of runs) {
      const manifest = getManifest(run.moduleId);
      if (manifest && !states?.[run.moduleId]) await enableModule(manifest);
    }
    onClose();
    startQueue(runs);
  }

  async function chooseTile(id: OriginId) {
    setError('');
    setOrigin(id);
    if (id === 'other') return pick();
    setPhase('files');
  }

  async function pick() {
    setError('');
    try {
      const raw = await pickRawFiles('*/*');
      if (raw.length === 0) return;
      const controller = new AbortController();
      setAbort(controller);
      setPhase('reading');
      const expanded = await runJob(
        'expand',
        { files: raw },
        { signal: controller.signal, onProgress: (done, total) => setProgress({ done, total }) },
      );
      setRead({
        files: expanded.files,
        binary: expanded.binary,
        name: raw.length === 1 ? raw[0]!.name : t.onboarding.filesChosen(raw.length),
      });
      // Counted once here: some sources parse their files for it.
      setFound(
        detectSources(expanded.files).map((d) => ({
          ...d,
          counts: summaryLine(d.source.summarize?.(filesOf(d.source, expanded.files))),
        })),
      );
      setManual(false);
      setPhase('found');
    } catch (e) {
      if (!isAbort(e))
        setError(
          e instanceof Error && e.message === 'file-too-large'
            ? t.onboarding.fileTooLarge
            : t.onboarding.readError,
        );
      setPhase(origin && origin !== 'other' ? 'files' : 'where');
    } finally {
      setAbort(null);
      setProgress(null);
    }
  }

  const errorLine = error ? (
    <p role="alert" className={styles.error}>
      {error}
    </p>
  ) : null;

  if (phase === 'where')
    return (
      <div className={styles.sheet}>
        <Head step={1} />
        <p className={styles.lead}>{text.whereLead}</p>
        <ul className={styles.tiles} aria-label={text.whereTitle}>
          {ORIGIN_TILES.map((o, i) => (
            <li key={o.id}>
              <button
                type="button"
                className={styles.tile}
                data-autofocus={i === 0 ? true : undefined}
                onClick={() => void chooseTile(o.id)}
              >
                <Icon name={o.icon} />
                <span>{text.origins[o.id as keyof typeof text.origins].title}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.muted}>{text.privacy}</p>
        {errorLine}
      </div>
    );

  if (phase === 'files' || phase === 'reading') {
    const info = origin ? text.origins[origin as keyof typeof text.origins] : undefined;
    return (
      <div className={styles.sheet}>
        <Head step={2} />
        {info ? <p className={styles.lead}>{info.how}</p> : null}
        {phase === 'reading' ? (
          <p role="status">
            {progress ? text.reading(progress.done, progress.total) : text.parsing}
          </p>
        ) : null}
        <div className={styles.bar}>
          {phase === 'reading' ? (
            <Button onClick={() => abort?.abort()}>{text.cancel}</Button>
          ) : (
            <>
              <Button onClick={() => setPhase('where')}>{text.back}</Button>
              <Button variant="primary" data-autofocus onClick={() => void pick()}>
                {text.choose}
              </Button>
            </>
          )}
        </div>
        {errorLine}
      </div>
    );
  }

  // phase 'found'
  const files = read?.files ?? [];
  const sure = found.filter((d) => d.confidence >= 0.6);
  const offered = manual ? [] : found;
  const toVault = offered.some((d) => d.source.targets.some((tg) => tg.route));
  return (
    <div className={styles.sheet}>
      <Head step={3} />
      {offered.length === 0 && !manual ? (
        <EmptyState
          title={text.nothingTitle}
          motif={<SignatureMark id="arrowProgress" size={64} />}
        >
          <p>{files.length === 0 ? text.nothing : text.unknown}</p>
        </EmptyState>
      ) : null}
      {offered.length > 0 ? (
        <>
          <h3 className={styles.headTitle}>{text.foundTitle}</h3>
          <ul className={styles.found} aria-label={text.foundTitle}>
            {offered.map((d) => {
              const level = certainty(d.confidence);
              const counts = d.counts;
              const target = d.source.targets[0];
              const module = target ? getManifest(target.moduleId)?.name : undefined;
              return (
                <li key={d.source.id} className={styles.foundItem}>
                  <span className={styles.foundTitle}>
                    <span>{sourceName(d.source.id)}</span>
                    <Badge tone={level === 'sure' ? 'success' : 'neutral'}>
                      {text.certainty[level]}
                    </Badge>
                  </span>
                  {counts ? <span>{counts}</span> : null}
                  <span className={styles.muted}>
                    {text.why[d.source.id as keyof typeof text.why] ?? ''}
                    {module ? ` ${text.goesTo(module)}` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
          {toVault ? <p className={styles.muted}>{text.vaultHint}</p> : null}
        </>
      ) : null}
      {offered.length === 0 ? (
        <div className={styles.found}>
          <p className={styles.lead}>{text.pickSource}</p>
          {SOURCES.map((source) => (
            <Button key={source.id} onClick={() => void launch([source])}>
              {sourceName(source.id)}
            </Button>
          ))}
        </div>
      ) : null}
      <div className={styles.bar}>
        <Button onClick={() => setPhase(origin && origin !== 'other' ? 'files' : 'where')}>
          {text.back}
        </Button>
        {offered.length > 0 ? (
          <>
            <Button variant="ghost" onClick={() => setManual(true)}>
              {text.manual}
            </Button>
            <Button
              variant="primary"
              data-autofocus
              onClick={() => void launch((sure.length > 0 ? sure : offered).map((d) => d.source))}
            >
              {toVault && sure.every((d) => d.source.targets.every((tg) => tg.route))
                ? text.openVault
                : text.openPreview}
            </Button>
          </>
        ) : null}
      </div>
      {errorLine}
    </div>
  );
}

/** After the last part of a run: what landed where, and one undo for all of it. */
function RunSummary({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const text = t.importers;
  const toast = useUiStore((s) => s.toast);
  const run = useImportRun(groupId);
  const [busy, setBusy] = useState(false);
  // Every part was cancelled or already undone: nothing to sum up.
  const empty = run === null || (run !== undefined && run.parts.every((p) => p.undone));
  useEffect(() => {
    if (empty) onClose();
  }, [empty, onClose]);
  if (!run || empty) return null;
  async function undoAll() {
    setBusy(true);
    try {
      const { removed, kept } = await undoRun(groupId);
      toast(t.onboarding.undone(removed, kept));
      onClose();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.sheet}>
      <p role="status">{text.runDone(run.count)}</p>
      <ul className={styles.parts} aria-label={text.runParts}>
        {run.parts.map((p) => (
          <li key={p.batchId}>
            {text.runPart(getManifest(p.moduleId)?.name ?? p.moduleId, p.count)}
            {p.undone ? ` · ${t.onboarding.recentUndone}` : ''}
          </li>
        ))}
      </ul>
      <p className={styles.muted}>{text.runUndoHint}</p>
      <div className={styles.bar}>
        <Button disabled={busy} onClick={() => void undoAll()}>
          {text.undoRun}
        </Button>
        <Button variant="primary" data-autofocus onClick={onClose}>
          {t.onboarding.close}
        </Button>
      </div>
    </div>
  );
}
