import { useEffect, useMemo, useState } from 'react';
import { localModelGap } from '@/core/ai/local/availability';
import {
  findModelByFile,
  isVerifiable,
  LOCAL_MODELS,
  modelCardUrl,
  type CatalogueModel,
} from '@/core/ai/local/catalogue';
import { useLocalPrefs, writeLocalPrefs } from '@/core/ai/local/prefs';
import { createLocalStage } from '@/core/ai/local/stage';
import { useLocalModel } from '@/core/ai/local/state';
import { writableModules } from '@/core/ai/prompt';
import { loadModuleStates } from '@/core/modules/activation';
import { activeManifests } from '@/core/modules/contributions';
import { getPlatform } from '@/core/platform';
import { today } from '@/core/time/dates';
import { BUILD_CHANNEL } from '@/core/update/buildInfo';
import { STABLE_RELEASE_PAGE } from '@/core/update/github';
import { t } from '@/strings';
import { Badge, Button, Dialog, SettingRow, SettingsGroup, Switch } from '@/ui';
import styles from './settings.module.css';

const l = t.ai.local;
const gb = (bytes: number): string => (bytes / 1024 ** 3).toFixed(2).replace('.', ',');
const gbShort = (bytes: number): string => (bytes / 1024 ** 3).toFixed(1).replace('.', ',');

/** The model's own words about this device: which profile fits the RAM. */
function useRecommendedProfile(): 'standard' | 'light' | undefined {
  const [profile, setProfile] = useState<'standard' | 'light' | undefined>();
  useEffect(() => {
    let alive = true;
    const system = getPlatform().system;
    if (!system.supported) return;
    void system
      .info()
      .then(
        (info) =>
          alive && setProfile(info.memory.totalBytes >= 12 * 1024 ** 3 ? 'standard' : 'light'),
      )
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return profile;
}

/**
 * The two or three models offered as the next step: verifiable ones of the profile that fits this
 * device (Standard when unknown), in catalogue order (the catalogue lists the preferred first).
 */
function suggestedModels(
  models: readonly CatalogueModel[],
  profile: 'standard' | 'light' | undefined,
): (CatalogueModel & { sha256: string })[] {
  const want = profile ?? 'standard';
  const usable = models.filter((m): m is CatalogueModel & { sha256: string } => isVerifiable(m));
  const fit = usable.filter((m) => m.profile === want);
  return (fit.length > 0 ? fit : usable).slice(0, 3);
}

function Consent({
  model,
  onConfirm,
  onClose,
}: {
  model: CatalogueModel & { sha256: string };
  onConfirm: () => void;
  onClose: () => void;
}) {
  const c = l.consent;
  return (
    <Dialog
      open
      onClose={onClose}
      title={c.title(model.label)}
      footer={
        <>
          <Button onClick={onClose}>{l.cancel}</Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            data-autofocus
            data-testid="local-consent-confirm"
          >
            {c.confirm}
          </Button>
        </>
      }
    >
      <p>{c.intro}</p>
      <dl className={styles.facts} data-testid="local-consent">
        <dt>{c.size}</dt>
        <dd>{l.size(gb(model.bytes))}</dd>
        <dt>{c.source}</dt>
        <dd>
          huggingface.co/{model.repo} · {model.file}
        </dd>
        <dt>{c.checksum}</dt>
        <dd className={styles.mono}>{model.sha256}</dd>
        <dt>{c.license}</dt>
        <dd>
          <a href={model.license.url} target="_blank" rel="noreferrer">
            {model.license.name}
          </a>
        </dd>
      </dl>
      <p>{c.verify}</p>
    </Dialog>
  );
}

/** Settings → KI → Lokales Modell: status, choice, download with consent, load, test. */
export function LocalModelSection({
  models = LOCAL_MODELS,
}: {
  models?: readonly CatalogueModel[];
}) {
  const prefs = useLocalPrefs();
  const { status, busy, progress, error, refresh, download, cancelDownload, remove, load, unload } =
    useLocalModel();
  const recommended = useRecommendedProfile();
  const [asking, setAsking] = useState<(CatalogueModel & { sha256: string }) | undefined>();
  const [test, setTest] = useState<{ state: 'running' | 'ok' | 'none'; text?: string }>();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const gpu = status?.devices.find((d) => d.gpu);
  const loaded = status?.loaded;
  const loadedModel = loaded ? findModelByFile(loaded.file) : undefined;
  const downloaded = useMemo(() => new Set(status?.models.map((m) => m.file)), [status]);

  async function runTest() {
    setTest({ state: 'running' });
    const started = performance.now();
    const manifests = writableModules(activeManifests(await loadModuleStates()));
    const proposal = await createLocalStage().propose(l.testSentence, {
      manifests,
      today: today(),
      database: (await import('@/core/db/db')).db,
    });
    const seconds = ((performance.now() - started) / 1000).toFixed(1).replace('.', ',');
    const first = proposal?.ops[0];
    setTest(
      first
        ? {
            state: 'ok',
            text: l.testOk(
              `${first.module}.${first.action}${first.data ? ` ${JSON.stringify(first.data)}` : ''}`,
              seconds,
            ),
          }
        : { state: 'none' },
    );
  }

  if (!status) return null;
  const gap = localModelGap(status, getPlatform().kind, BUILD_CHANNEL);
  if (gap) {
    return (
      <SettingsGroup
        id="ai-local"
        title={l.title}
        description={l.description}
        hint={t.help.aiLocal}
      >
        <p data-testid="local-unavailable">{l.unavailable[gap]}</p>
        {gap === 'testBuild' ? (
          <p>
            <Button
              onClick={() => void getPlatform().app.openUrl(STABLE_RELEASE_PAGE)}
              data-testid="local-get-stable"
            >
              {l.getStable}
            </Button>
          </p>
        ) : null}
      </SettingsGroup>
    );
  }

  const ready = Boolean(prefs.file && downloaded.has(prefs.file));
  const downloading = busy === 'download' && progress !== undefined;
  const suggestions = suggestedModels(
    models.filter((m) => !downloaded.has(m.file)),
    recommended,
  );

  return (
    <SettingsGroup id="ai-local" title={l.title} description={l.description} hint={t.help.aiLocal}>
      <section aria-labelledby="ai-local-next" data-testid="local-next">
        <h3 id="ai-local-next">{l.next.title}</h3>
        {downloading ? (
          <div role="status" data-testid="local-progress">
            <p>{l.next.downloading}</p>
            <progress value={progress.done} max={progress.total} />{' '}
            {l.progress(gb(progress.done), gb(progress.total))}{' '}
            <Button variant="ghost" onClick={cancelDownload}>
              {l.cancel}
            </Button>
          </div>
        ) : ready ? (
          <>
            <p>{l.next.ready}</p>
            <Button
              variant="primary"
              onClick={() => void runTest()}
              disabled={busy !== undefined || test?.state === 'running'}
              data-testid="local-next-test"
            >
              {l.next.ask}
            </Button>
          </>
        ) : (
          <>
            <p>{l.next.pick}</p>
            <ul className={styles.models} data-testid="local-suggestions">
              {suggestions.map((m, i) => (
                <li key={m.id} className={styles.model}>
                  <div className={styles.modelHead}>
                    <strong>{m.label}</strong>
                    {recommended === m.profile ? (
                      <Badge tone="accent">{l.recommended}</Badge>
                    ) : null}
                  </div>
                  <p className={styles.modelMeta}>
                    {l.size(gb(m.bytes))} · {l.license(m.license.name)}
                  </p>
                  <div className={styles.modelActions}>
                    <Button
                      variant={i === 0 ? 'primary' : undefined}
                      onClick={() => setAsking(m)}
                      disabled={busy !== undefined}
                      data-testid={`local-next-download-${m.id}`}
                    >
                      {l.download}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {test && ready ? (
          <p role="status" data-testid="local-test-result">
            {test.state === 'running'
              ? l.testRunning
              : test.state === 'ok'
                ? test.text
                : l.testNone}
          </p>
        ) : null}
      </section>
      <SettingRow
        id="ai-local--status"
        label={l.status}
        description={
          loaded
            ? l.loaded(
                loadedModel?.label ?? loaded.file,
                loaded.info.backend === 'gpu' ? l.backendGpu : l.backendCpu,
                `${gbShort(loaded.info.fileBytes)} GB`,
              )
            : busy === 'load'
              ? l.loading
              : l.notLoaded
        }
      >
        {loaded ? (
          <Button onClick={() => void unload()} disabled={busy !== undefined}>
            {l.unload}
          </Button>
        ) : (
          <Button
            onClick={() => void load()}
            disabled={busy !== undefined || !prefs.file || !downloaded.has(prefs.file)}
            data-testid="local-load"
          >
            {l.load}
          </Button>
        )}
      </SettingRow>
      {error ? (
        <p role="alert" className={styles.error} data-testid="local-error">
          {l.errors[error] ?? l.errors.fallback}
        </p>
      ) : null}

      <SettingRow id="ai-local--first" label={l.first} description={l.firstHint}>
        <Switch
          label={l.first}
          labelHidden
          checked={prefs.first}
          onChange={(first) => writeLocalPrefs({ first })}
        />
      </SettingRow>
      <SettingRow id="ai-local--autoload" label={l.autoLoad} description={l.autoLoadHint}>
        <Switch
          label={l.autoLoad}
          labelHidden
          checked={prefs.autoLoad}
          onChange={(autoLoad) => writeLocalPrefs({ autoLoad })}
        />
      </SettingRow>
      <SettingRow
        id="ai-local--gpu"
        label={l.gpu}
        description={gpu ? l.gpuFound(gpu.description || gpu.name) : l.gpuNone}
      >
        <Switch
          label={l.gpu}
          labelHidden
          checked={prefs.gpu && Boolean(gpu)}
          disabled={!gpu}
          onChange={(on) => writeLocalPrefs({ gpu: on })}
        />
      </SettingRow>

      <h3>{l.models}</h3>
      <ul className={styles.models} data-testid="local-models">
        {models.map((m) => {
          const has = downloaded.has(m.file);
          const using = prefs.file === m.file;
          const verifiable = isVerifiable(m);
          return (
            <li key={m.id} className={styles.model} data-testid={`local-model-${m.id}`}>
              <div className={styles.modelHead}>
                <strong>{m.label}</strong>
                <Badge tone="neutral">{l.profile[m.profile]}</Badge>
                {recommended === m.profile ? <Badge tone="accent">{l.recommended}</Badge> : null}
                {has ? <Badge tone="neutral">{using ? l.inUse : l.downloaded}</Badge> : null}
              </div>
              <p className={styles.modelMeta}>
                {l.size(gb(m.bytes))} ·{' '}
                <a href={m.license.url} target="_blank" rel="noreferrer">
                  {l.license(m.license.name)}
                </a>{' '}
                ·{' '}
                <a href={modelCardUrl(m)} target="_blank" rel="noreferrer">
                  {l.modelCard}
                </a>
              </p>
              {!has && !verifiable ? <p className={styles.note}>{l.noChecksum}</p> : null}
              <div className={styles.modelActions}>
                {has ? (
                  <>
                    <Button
                      onClick={() => {
                        writeLocalPrefs({ file: m.file });
                        if (loaded && loaded.file !== m.file) void unload();
                      }}
                      disabled={using}
                    >
                      {l.use}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => void remove(m.file)}
                      disabled={busy !== undefined}
                    >
                      {l.remove}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => verifiable && setAsking(m)}
                    disabled={!verifiable || busy !== undefined}
                    data-testid={`local-download-${m.id}`}
                  >
                    {l.download}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <SettingRow id="ai-local--folder" label={l.folder} description={status.folder}>
        {getPlatform().desktop.supported ? (
          <Button variant="ghost" onClick={() => void getPlatform().desktop.openDataDir()}>
            {l.openFolder}
          </Button>
        ) : null}
      </SettingRow>
      <SettingRow id="ai-local--test" label={l.test} description={l.testHint}>
        <Button
          onClick={() => void runTest()}
          disabled={
            busy !== undefined ||
            !prefs.file ||
            !downloaded.has(prefs.file) ||
            test?.state === 'running'
          }
          data-testid="local-test"
        >
          {l.test}
        </Button>
      </SettingRow>

      {asking ? (
        <Consent
          model={asking}
          onClose={() => setAsking(undefined)}
          onConfirm={() => {
            const model = asking;
            setAsking(undefined);
            // A choice whose file is gone (cancelled, failed, removed) is replaced by the new download.
            if (!prefs.file || !downloaded.has(prefs.file)) writeLocalPrefs({ file: model.file });
            void download(model);
          }}
        />
      ) : null}
    </SettingsGroup>
  );
}
