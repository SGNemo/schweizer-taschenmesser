import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getPlatform } from '@/core/platform';
import type { DownloadJob } from '@/core/platform/downloads';
import { useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import {
  Button,
  Dialog,
  EmptyState,
  Form,
  FormActions,
  Icon,
  IconButton,
  ItemList,
  ItemRow,
  PageHeader,
  Progress,
  TextField,
} from '@/ui';
import { formatBytes, percent } from '../lib/format';
import { settings, type DownloadsPrefs } from '../settings';
import { ensureWatching, useJobs } from '../store';
import styles from './DownloadsPage.module.css';

const ERRORS = ['scheme', 'url', 'dir', 'hash'] as const;

export default function DownloadsPage() {
  const platform = getPlatform().downloads;
  const [params, setParams] = useSearchParams();
  const jobs = useJobs((s) => s.jobs);
  const [stored] = useSettings('module.downloads', settings.schema, settings.defaults);
  const prefs = (stored ?? settings.defaults) as DownloadsPrefs;

  const [adding, setAdding] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<DownloadJob | null>(null);
  const [deleting, setDeleting] = useState<DownloadJob | null>(null);

  useEffect(() => {
    ensureWatching();
  }, []);

  // The speed limit of the setting applies to everything while the page (or the widget) is open.
  useEffect(() => {
    if (platform.supported) void platform.setLimit(Math.round(prefs.limitKb * 1024));
  }, [platform, prefs.limitKb]);

  // `?add=<address>` (from the browser or the widget) opens the add dialog; nothing starts by itself.
  useEffect(() => {
    if (!params.has('add')) return;
    const url = params.get('add') ?? '';
    setParams({}, { replace: true });
    queueMicrotask(() => setAdding(url));
  }, [params, setParams]);

  if (!platform.supported) {
    return (
      <>
        <PageHeader title={t.downloads.meta.name} />
        <EmptyState title={t.downloads.unsupported.title}>
          {t.downloads.unsupported.body}
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t.downloads.meta.name} />
      <p className={styles.hint}>{t.downloads.hint}</p>
      <div className={styles.bar}>
        <Button variant="primary" onClick={() => setAdding('')}>
          {t.downloads.add.button}
        </Button>
      </div>

      {jobs && jobs.length === 0 ? (
        <EmptyState title={t.downloads.empty.title}>{t.downloads.empty.body}</EmptyState>
      ) : null}

      <ItemList label={t.downloads.meta.name}>
        {(jobs ?? []).map((j) => (
          <JobRow
            key={j.id}
            job={j}
            onVerify={() => setVerifying(j)}
            onDeleteData={() => setDeleting(j)}
          />
        ))}
      </ItemList>

      <AddDialog
        open={adding !== null}
        initialUrl={adding ?? ''}
        defaultFolder={prefs.folder}
        onClose={() => setAdding(null)}
      />
      <VerifyDialog job={verifying} onClose={() => setVerifying(null)} />
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t.downloads.deleteData.title}
        footer={
          <FormActions>
            <Button onClick={() => setDeleting(null)}>{t.downloads.add.cancel}</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleting) void platform.remove(deleting.id, true);
                setDeleting(null);
              }}
            >
              {t.downloads.deleteData.confirm}
            </Button>
          </FormActions>
        }
      >
        <p>{deleting ? t.downloads.deleteData.body(deleting.fileName) : null}</p>
      </Dialog>
    </>
  );
}

function JobRow({
  job,
  onVerify,
  onDeleteData,
}: {
  job: DownloadJob;
  onVerify: () => void;
  onDeleteData: () => void;
}) {
  const platform = getPlatform().downloads;
  const pct = percent(job.done, job.total);
  const sizes = job.total
    ? t.downloads.row.progress(formatBytes(job.done), formatBytes(job.total))
    : t.downloads.row.unknownTotal(formatBytes(job.done));
  const speed =
    job.state === 'running' && job.speedBps > 0
      ? ` · ${t.downloads.row.speed(formatBytes(job.speedBps))}`
      : '';
  const failed =
    job.state === 'failed'
      ? ((t.downloads.failed as Record<string, string>)[job.error ?? ''] ??
        t.downloads.errors.other)
      : null;
  const canPause = job.state === 'running' || job.state === 'queued';
  const canResume = job.state === 'paused' || job.state === 'failed';

  return (
    <ItemRow
      title={job.fileName}
      meta={`${t.downloads.state[job.state]} · ${sizes}${speed}`}
      lead={<Icon name="download" />}
      actions={
        <>
          {canPause ? (
            <IconButton
              label={t.downloads.actions.pause}
              onClick={() => void platform.pause(job.id)}
            >
              <Icon name="pause" />
            </IconButton>
          ) : null}
          {canResume ? (
            <IconButton
              label={
                job.state === 'failed' ? t.downloads.actions.retry : t.downloads.actions.resume
              }
              onClick={() => void platform.resume(job.id)}
            >
              <Icon name="play" />
            </IconButton>
          ) : null}
          <IconButton
            label={t.downloads.actions.reveal}
            onClick={() => void platform.reveal(job.id)}
          >
            <Icon name="external" />
          </IconButton>
        </>
      }
      menuLabel={t.downloads.actions.more}
      menu={[
        {
          id: 'remove',
          label: t.downloads.actions.remove,
          onSelect: () => void platform.remove(job.id, false),
        },
        {
          id: 'removeData',
          label: t.downloads.actions.removeData,
          danger: true,
          onSelect: onDeleteData,
        },
        ...(job.state === 'done'
          ? [{ id: 'verify', label: t.downloads.checksum.verify, onSelect: onVerify }]
          : []),
      ]}
    >
      <div className={styles.detail}>
        {job.state !== 'done' ? (
          <Progress
            value={job.done}
            max={job.total ?? Math.max(job.done, 1)}
            label={`${job.fileName} ${pct} %`}
          />
        ) : null}
        {failed ? <span className={styles.error}>{failed}</span> : null}
        {job.state === 'done' && job.sha256 ? (
          <span className={styles.sub}>
            {t.downloads.checksum.label}: <span className={styles.hash}>{job.sha256}</span>
            {job.hashCheck
              ? ` · ${job.hashCheck === 'match' ? t.downloads.checksum.match : t.downloads.checksum.mismatch}`
              : ''}
          </span>
        ) : null}
        <span className={styles.sub}>{job.dir}</span>
      </div>
    </ItemRow>
  );
}

function AddDialog({
  open,
  initialUrl,
  defaultFolder,
  onClose,
}: {
  open: boolean;
  initialUrl: string;
  defaultFolder: string;
  onClose: () => void;
}) {
  const platform = getPlatform().downloads;
  const [url, setUrl] = useState('');
  const [dir, setDir] = useState('');
  const [hash, setHash] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  // Each opening starts from the given address and the chosen (or system) folder.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setUrl(initialUrl);
      setHash('');
      setError(null);
      setDir(defaultFolder);
    }
  }
  useEffect(() => {
    if (open && !dir)
      void platform
        .defaultDir()
        .then(setDir)
        .catch(() => undefined);
  }, [open, dir, platform]);

  async function submit() {
    try {
      await platform.add(url.trim(), dir, hash.trim() || undefined);
      onClose();
    } catch (e) {
      const code = e instanceof Error ? e.message : String(e);
      setError(
        (ERRORS as readonly string[]).includes(code)
          ? (t.downloads.errors as Record<string, string>)[code]!
          : t.downloads.errors.other,
      );
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t.downloads.add.title}>
      <Form onSubmit={() => void submit()}>
        <TextField
          label={t.downloads.add.url}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          data-autofocus
        />
        {url.trim().toLowerCase().startsWith('http://') ? (
          <p className={styles.sub}>{t.downloads.add.http}</p>
        ) : null}
        <TextField
          label={t.downloads.add.folder}
          value={dir}
          onChange={(e) => setDir(e.target.value)}
        />
        <div>
          <Button
            onClick={() =>
              void platform.pickDir().then((picked) => {
                if (picked) setDir(picked);
              })
            }
          >
            {t.downloads.add.pick}
          </Button>
        </div>
        <TextField
          label={t.downloads.add.hash}
          hint={t.downloads.add.hashHelp}
          value={hash}
          onChange={(e) => setHash(e.target.value)}
        />
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <FormActions>
          <Button onClick={onClose}>{t.downloads.add.cancel}</Button>
          <Button type="submit" variant="primary" disabled={!url.trim() || !dir}>
            {t.downloads.add.submit}
          </Button>
        </FormActions>
      </Form>
    </Dialog>
  );
}

function VerifyDialog({ job, onClose }: { job: DownloadJob | null; onClose: () => void }) {
  const platform = getPlatform().downloads;
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);
  if ((job !== null) !== wasOpen) {
    setWasOpen(job !== null);
    if (job) {
      setValue('');
      setError(null);
    }
  }
  async function submit() {
    if (!job) return;
    try {
      await platform.verify(job.id, value.trim());
      onClose();
    } catch {
      setError(t.downloads.errors.hash);
    }
  }
  return (
    <Dialog open={job !== null} onClose={onClose} title={t.downloads.checksum.verifyTitle}>
      <Form onSubmit={() => void submit()}>
        <TextField
          label={t.downloads.checksum.field}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          data-autofocus
        />
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <FormActions>
          <Button onClick={onClose}>{t.downloads.add.cancel}</Button>
          <Button type="submit" variant="primary" disabled={!value.trim()}>
            {t.downloads.checksum.submit}
          </Button>
        </FormActions>
      </Form>
    </Dialog>
  );
}
