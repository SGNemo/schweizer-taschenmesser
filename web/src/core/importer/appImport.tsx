/**
 * "Aus anderer App importieren": pick the files of an export (ZIP too), unpack them in a Worker,
 * recognise the source, and hand the files to the existing preview/undo wizard of the target
 * module(s). No own preview, no own write path: everything after detection is the generic flow.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { create } from 'zustand';
import { enableModule, useModuleStates } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { importersOf } from '@/core/dataapi/onboarding';
import { pickRawFiles } from '@/core/io/pickFile';
import { detectSources, SOURCES } from '@/importers/registry';
import { isAbort, runJob } from '@/importers/run';
import type { SourceDef, SourceFile } from '@/importers/types';
import { tImp } from '@/strings.importers';
import { t } from '@/strings';
import { Button, Dialog, patternStyles } from '@/ui';
import { newBatchId } from './batches';
import { useOnboardingHost, type HostItem } from './host';

interface AppImportState {
  open: boolean;
  openDialog: () => void;
  close: () => void;
}

export const useAppImport = create<AppImportState>((set) => ({
  open: false,
  openDialog: () => set({ open: true }),
  close: () => set({ open: false }),
}));

/** For the command palette and the settings row. */
export const openAppImport = () => useAppImport.getState().openDialog();

/** Relevant files per source: those the source itself recognises. */
const filesOf = (source: SourceDef, files: SourceFile[]) =>
  files.filter((f) => source.detect([f]) >= 0.3);

/**
 * The wizard runs for the chosen sources: one per module and importer for importers that take
 * several files (notes), one per file for the others (a calendar file, a bank statement).
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
      if (meta.multiple) {
        const key = `${target.moduleId}|${target.importerId}`;
        const item = merged.get(key) ?? {
          moduleId: target.moduleId,
          preset: { importerId: target.importerId, files: [], binary, groupId, source },
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
            preset: { importerId: target.importerId, files: [f], groupId, source: f.name },
          });
      }
    }
  }
  return items;
}

type Phase = 'pick' | 'reading' | 'choose';

export function AppImportHost() {
  const { open, close } = useAppImport();
  if (!open) return null;
  return (
    <Dialog open onClose={close} title={tImp.get().title}>
      <AppImport onClose={close} />
    </Dialog>
  );
}

function AppImport({ onClose }: { onClose: () => void }) {
  const text = tImp.get();
  const navigate = useNavigate();
  const startQueue = useOnboardingHost((h) => h.openQueue);
  const states = useModuleStates();
  const [phase, setPhase] = useState<Phase>('pick');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [abort, setAbort] = useState<AbortController | null>(null);
  const [read, setRead] = useState<{ files: SourceFile[]; binary: number; name: string } | null>(
    null,
  );
  const [offered, setOffered] = useState<SourceDef[]>([]);

  async function launch(sources: SourceDef[], data = read) {
    if (!data) return;
    // A source that lives behind the vault password opens the vault's own import.
    const route = sources.flatMap((s) => s.targets).find((tg) => tg.route)?.route;
    const runs = planRuns(sources, data.files, data.binary, newBatchId(), data.name);
    if (runs.length === 0 && route) {
      onClose();
      void navigate(route);
      return;
    }
    if (runs.length === 0) return setError(text.nothing);
    for (const run of runs) {
      const manifest = getManifest(run.moduleId);
      if (manifest && !states?.[run.moduleId]) await enableModule(manifest);
    }
    onClose();
    startQueue(runs);
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
      const data = {
        files: expanded.files,
        binary: expanded.binary,
        name: raw.length === 1 ? raw[0]!.name : t.onboarding.filesChosen(raw.length),
      };
      setRead(data);
      const found = detectSources(data.files);
      const sure = found.filter((d) => d.confidence >= 0.6).map((d) => d.source);
      if (sure.length > 0 && !(sure.length === 1 && sure[0]!.targets.every((tg) => tg.route))) {
        // One clear answer (or a Takeout with several parts): straight to the preview.
        await launch(sure, data);
        return;
      }
      setOffered(found.map((d) => d.source));
      setPhase('choose');
    } catch (e) {
      if (!isAbort(e))
        setError(
          e instanceof Error && e.message === 'file-too-large'
            ? t.onboarding.fileTooLarge
            : t.onboarding.readError,
        );
      setPhase('pick');
    } finally {
      setAbort(null);
      setProgress(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      {phase === 'pick' ? (
        <>
          <p className={patternStyles.muted}>{text.intro}</p>
          <div className={patternStyles.hstackWrap}>
            <Button variant="primary" data-autofocus onClick={() => void pick()}>
              {text.choose}
            </Button>
          </div>
        </>
      ) : null}
      {phase === 'reading' ? (
        <>
          <p role="status">
            {progress ? text.reading(progress.done, progress.total) : text.parsing}
          </p>
          <div className={patternStyles.hstackWrap}>
            <Button onClick={() => abort?.abort()}>{text.cancel}</Button>
          </div>
        </>
      ) : null}
      {phase === 'choose' ? (
        <>
          <p>
            {offered.length > 0
              ? text.detected(
                  offered.map((s) => text.sources[s.id as keyof typeof text.sources]).join(', '),
                )
              : text.unknown}
          </p>
          {offered.some((s) => s.targets.some((tg) => tg.route)) ? <p>{text.vaultHint}</p> : null}
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            {(offered.length > 0 ? offered : [...SOURCES]).map((source) => (
              <Button key={source.id} onClick={() => void launch([source])}>
                {text.sources[source.id as keyof typeof text.sources]}
              </Button>
            ))}
          </div>
          {offered.length > 0 ? (
            <div className={patternStyles.hstackWrap}>
              <Button variant="ghost" onClick={() => setOffered([])}>
                {text.manual}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      {error ? (
        <p role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
