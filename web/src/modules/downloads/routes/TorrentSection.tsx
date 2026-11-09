import { useEffect, useState } from 'react';
import { requireNotice } from '@/core/legal/notices';
import { getPlatform } from '@/core/platform';
import type { TorrentInfo } from '@/core/platform/torrent';
import { useSettings } from '@/core/settings/settings';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Dialog, FormActions, Icon, IconButton, ItemList, ItemRow, Progress } from '@/ui';
import { formatBytes, percent } from '../lib/format';
import { settings, type DownloadsPrefs } from '../settings';
import { resetTorrents, useTorrents, watchTorrents } from '../torrentStore';
import { AddTorrentDialog } from './AddTorrentDialog';
import { DownloadsEmpty } from '../components/DownloadsEmpty';
import styles from './DownloadsPage.module.css';
import { TorrentIp } from './TorrentIp';

type Status = 'starting' | 'ready' | 'failed';

/** A magnet link or `.torrent` file path that arrived from outside (OS association, browser). */
export interface TorrentIncoming {
  kind: 'magnet' | 'file';
  value: string;
}

/** Recognises the two things the torrent part takes; anything else is a plain download address. */
export function asTorrentSource(value: string): TorrentIncoming | null {
  const v = value.trim();
  if (/^magnet:\?/i.test(v)) return { kind: 'magnet', value: v };
  if (/\.torrent$/i.test(v) && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v))
    return { kind: 'file', value: v };
  return null;
}

/** The BitTorrent part of the Downloads page. Off until the user switches it on (after the notice). */
export function TorrentSection({
  prefs,
  incoming,
  onIncomingHandled,
}: {
  prefs: DownloadsPrefs;
  incoming: TorrentIncoming | null;
  onIncomingHandled: () => void;
}) {
  const platform = getPlatform().torrent;
  const [, setPrefs] = useSettings('module.downloads', settings.schema, settings.defaults);
  const torrents = useTorrents((s) => s.torrents);
  const [status, setStatus] = useState<Status>('starting');
  const [adding, setAdding] = useState(false);
  // What the dialog starts with; it only pre-fills, the user still reviews the files and confirms.
  const [initial, setInitial] = useState<TorrentIncoming | null>(null);
  const [launchRegistered, setLaunchRegistered] = useState(false);
  const [deleting, setDeleting] = useState<TorrentInfo | null>(null);

  const limits = {
    uploadKb: prefs.torrentUpKb,
    downloadKb: prefs.torrentDownKb,
    seedRatio: prefs.seedRatio,
    seedMinutes: prefs.seedMinutes,
  };
  const limitKey = JSON.stringify(limits);
  const { torrentDht: dht, torrentUpnp: upnp } = prefs;

  // The engine starts only after the notice was confirmed; limits apply as soon as they change.
  useEffect(() => {
    if (!prefs.torrent || !platform.supported) return;
    let alive = true;
    void (async () => {
      await requireNotice('downloads-torrent');
      try {
        await platform.configure({ dht, upnp, ...(JSON.parse(limitKey) as typeof limits) });
        if (!alive) return;
        watchTorrents();
        setStatus('ready');
      } catch {
        if (alive) setStatus('failed');
      }
    })();
    return () => {
      alive = false;
    };
  }, [platform, prefs.torrent, dht, upnp, limitKey]);

  // Something arrived from outside: once the engine is up, the add dialog opens with it.
  useEffect(() => {
    if (!incoming || !prefs.torrent || status !== 'ready') return;
    queueMicrotask(() => {
      setInitial(incoming);
      setAdding(true);
      onIncomingHandled();
    });
  }, [incoming, prefs.torrent, status, onIncomingHandled]);

  const launch = getPlatform().launch;
  useEffect(() => {
    if (!launch.supported || !prefs.torrent) return;
    void launch.isRegistered().then(setLaunchRegistered, () => undefined);
  }, [launch, prefs.torrent]);

  async function toggleAssociation() {
    try {
      await launch.setRegistered(!launchRegistered);
      setLaunchRegistered(!launchRegistered);
      useUiStore
        .getState()
        .toast(
          launchRegistered ? t.downloads.torrent.launch.removed : t.downloads.torrent.launch.done,
        );
    } catch {
      useUiStore.getState().toast(t.downloads.torrent.launch.failed);
    }
  }

  if (!platform.supported) return null;

  if (!prefs.torrent) {
    return (
      // Off: one quiet block (heading, one line, a secondary button) – the page's one filled action stays „Download hinzufügen“ (U11).
      <section className={styles.torrent} data-testid="torrent-off">
        <h2>{t.downloads.torrent.off.title}</h2>
        <p className={styles.hint}>{t.downloads.torrent.off.body}</p>
        {incoming ? <p role="status">{t.downloads.torrent.launch.pendingOff}</p> : null}
        <div className={styles.bar}>
          <Button variant="secondary" onClick={() => void turnOn()}>
            {t.downloads.torrent.off.turnOn}
          </Button>
        </div>
      </section>
    );
  }

  async function turnOn() {
    await requireNotice('downloads-torrent');
    setPrefs({ torrent: true });
  }

  async function turnOff() {
    await platform.stop().catch(() => undefined);
    resetTorrents();
    setStatus('starting');
    setPrefs({ torrent: false });
  }

  return (
    <section className={styles.torrent}>
      <h2>{t.downloads.torrent.title}</h2>
      <p className={styles.hint}>{t.downloads.torrent.intro}</p>
      <p className={styles.hint}>{t.downloads.torrent.hint}</p>
      <div className={styles.bar}>
        <Button variant="primary" disabled={status !== 'ready'} onClick={() => setAdding(true)}>
          {t.downloads.torrent.add.button}
        </Button>
        <Button onClick={() => void turnOff()}>{t.downloads.torrent.turnOff}</Button>
      </div>
      {status === 'starting' ? <p role="status">{t.downloads.torrent.starting}</p> : null}
      {status === 'failed' ? (
        <p role="alert" className={styles.error}>
          {t.downloads.torrent.startFailed}
        </p>
      ) : null}

      {status === 'ready' && torrents && torrents.length === 0 ? (
        <DownloadsEmpty title={t.downloads.torrent.empty.title}>
          {t.downloads.torrent.empty.body}
        </DownloadsEmpty>
      ) : null}
      <ItemList label={t.downloads.torrent.title}>
        {(torrents ?? []).map((x) => (
          <TorrentRow key={x.id} torrent={x} onDeleteData={() => setDeleting(x)} />
        ))}
      </ItemList>

      {launch.supported ? (
        <div>
          <h3>{t.downloads.torrent.launch.title}</h3>
          <p className={styles.hint}>{t.downloads.torrent.launch.help}</p>
          <Button onClick={() => void toggleAssociation()}>
            {launchRegistered
              ? t.downloads.torrent.launch.remove
              : t.downloads.torrent.launch.register}
          </Button>
        </div>
      ) : null}
      <TorrentIp />
      <AddTorrentDialog
        open={adding}
        defaultFolder={prefs.folder}
        initial={initial}
        onClose={() => setAdding(false)}
      />
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t.downloads.torrent.deleteData.title}
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
              {t.downloads.torrent.deleteData.confirm}
            </Button>
          </FormActions>
        }
      >
        <p>{deleting ? t.downloads.torrent.deleteData.body(deleting.name) : null}</p>
      </Dialog>
    </section>
  );
}

function TorrentRow({
  torrent: x,
  onDeleteData,
}: {
  torrent: TorrentInfo;
  onDeleteData: () => void;
}) {
  const platform = getPlatform().torrent;
  const pct = percent(x.progressBytes, x.totalBytes);
  const running = x.state === 'downloading' || x.state === 'seeding' || x.state === 'starting';
  const live = x.state === 'downloading' || x.state === 'seeding';
  const parts = [
    t.downloads.torrent.state[x.state],
    t.downloads.row.progress(formatBytes(x.progressBytes), formatBytes(x.totalBytes)),
    ...(live
      ? [
          t.downloads.torrent.row.down(formatBytes(x.downBps)),
          t.downloads.torrent.row.up(formatBytes(x.upBps)),
          t.downloads.torrent.row.peers(x.peers),
        ]
      : []),
    t.downloads.torrent.row.ratio(x.ratio.toFixed(2)),
  ];
  return (
    <ItemRow
      title={x.name}
      meta={parts.join(' · ')}
      lead={<Icon name="download" />}
      actions={
        running ? (
          <IconButton
            label={t.downloads.torrent.actions.pause}
            onClick={() => void platform.pause(x.id)}
          >
            <Icon name="pause" />
          </IconButton>
        ) : (
          <IconButton
            label={t.downloads.torrent.actions.resume}
            onClick={() => void platform.resume(x.id)}
          >
            <Icon name="play" />
          </IconButton>
        )
      }
      menuLabel={t.downloads.actions.more}
      menu={[
        {
          id: 'remove',
          label: t.downloads.torrent.actions.remove,
          onSelect: () => void platform.remove(x.id, false),
        },
        {
          id: 'removeData',
          label: t.downloads.torrent.actions.removeData,
          danger: true,
          onSelect: onDeleteData,
        },
      ]}
    >
      <div className={styles.detail}>
        {x.state === 'downloading' || x.state === 'paused' || x.state === 'starting' ? (
          <Progress
            value={x.progressBytes}
            max={Math.max(x.totalBytes, 1)}
            label={`${x.name} ${pct} %`}
          />
        ) : null}
        {x.error ? <span className={styles.error}>{x.error}</span> : null}
        <span className={styles.sub}>{x.dir}</span>
      </div>
    </ItemRow>
  );
}
