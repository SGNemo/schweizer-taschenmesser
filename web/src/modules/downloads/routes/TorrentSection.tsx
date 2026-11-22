import { useEffect, useId, useRef, useState } from 'react';
import { requireNotice } from '@/core/legal/notices';
import { getPlatform } from '@/core/platform';
import type { TorrentInfo } from '@/core/platform/torrent';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import {
  Button,
  Dialog,
  FormActions,
  Icon,
  IconButton,
  ItemList,
  ItemRow,
  Progress,
  Switch,
} from '@/ui';
import { useDevicePrefs } from '../devicePrefs';
import { formatBytes, percent } from '../lib/format';
import type { DownloadsPrefs } from '../settings';
import {
  clearStopped,
  markStopped,
  resetTorrents,
  useTorrents,
  watchTorrents,
} from '../torrentStore';
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
  // on/off, DHT, UPnP and the folder: this PC only (DL10)
  const [device, setDevice] = useDevicePrefs();
  const torrents = useTorrents((s) => s.torrents);
  const stopped = useTorrents((s) => s.stopped);
  const [status, setStatus] = useState<Status>('starting');
  const hintId = useId();
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
  const { dht, upnp } = device;
  // Stopped outside the page (the tray's „Torrent läuft – beenden“, closing into the tray while
  // idle): the page says so and waits for a click; a deliberate stop is not undone by itself.
  // a click asked for the engine: the next configure ends a stop made outside the page
  const resume = useRef(false);
  useEffect(() => {
    if (!device.torrent || !platform.onStopped) return;
    return platform.onStopped(() => {
      setAdding(false);
      setStatus('starting');
      markStopped();
    });
  }, [platform, device.torrent]);

  // The engine starts only after the notice was confirmed; limits apply as soon as they change.
  useEffect(() => {
    if (!device.torrent || !platform.supported || stopped) return;
    let alive = true;
    void (async () => {
      await requireNotice('downloads-torrent');
      try {
        const asked = resume.current;
        resume.current = false;
        await platform.configure({
          dht,
          upnp,
          ...(JSON.parse(limitKey) as typeof limits),
          resume: asked,
        });
        if (!alive) return;
        watchTorrents();
        setStatus('ready');
      } catch (e) {
        if (!alive) return;
        // stopped in the tray while this page was away: wait for a click
        if ((e instanceof Error ? e.message : String(e)) === 'stopped') markStopped();
        else setStatus('failed');
      }
    })();
    return () => {
      alive = false;
    };
  }, [platform, device.torrent, dht, upnp, limitKey, stopped]);

  // Something arrived from outside: once the engine is up, the add dialog opens with it.
  useEffect(() => {
    if (!incoming || !device.torrent) return;
    // a link the user opened is the wish to use BitTorrent: a stop from the tray ends here
    if (stopped) {
      queueMicrotask(() => {
        setStatus('starting');
        resume.current = true;
        clearStopped();
      });
      return;
    }
    if (status !== 'ready') return;
    queueMicrotask(() => {
      setInitial(incoming);
      setAdding(true);
      onIncomingHandled();
    });
  }, [incoming, device.torrent, status, stopped, onIncomingHandled]);

  const launch = getPlatform().launch;
  useEffect(() => {
    if (!launch.supported || !device.torrent) return;
    void launch.isRegistered().then(setLaunchRegistered, () => undefined);
  }, [launch, device.torrent]);

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

  if (!device.torrent) {
    return (
      // Off: one quiet block (heading, one line, a secondary button) – the page's one filled action stays „Download eintragen“ (U11).
      <section className={styles.torrent}>
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
    resume.current = true;
    clearStopped();
    setDevice({ torrent: true });
  }

  async function turnOff() {
    await platform.stop().catch(() => undefined);
    resetTorrents();
    setStatus('starting');
    setDevice({ torrent: false });
  }

  // DHT and UPnP are read when the engine starts: a change restarts it with the new value.
  async function setNetwork(patch: { dht?: boolean; upnp?: boolean }) {
    await platform.stop().catch(() => undefined);
    resetTorrents();
    setStatus('starting');
    resume.current = true;
    clearStopped();
    setDevice(patch);
  }

  return (
    <section className={styles.torrent}>
      <h2>{t.downloads.torrent.title}</h2>
      <p className={styles.hint}>{t.downloads.torrent.intro}</p>
      <p className={styles.hint}>{t.downloads.torrent.hint}</p>
      <div className={styles.bar}>
        <Button
          variant="primary"
          disabled={status !== 'ready' || stopped}
          onClick={() => setAdding(true)}
        >
          {t.downloads.torrent.add.button}
        </Button>
        <Button onClick={() => void turnOff()}>{t.downloads.torrent.turnOff}</Button>
      </div>
      {status === 'starting' && !stopped ? (
        <p role="status">{t.downloads.torrent.starting}</p>
      ) : null}
      {stopped ? (
        <div className={styles.bar}>
          <p role="status" className={styles.hint}>
            {t.downloads.torrent.stopped}
          </p>
          <Button
            onClick={() => {
              setStatus('starting');
              resume.current = true;
              clearStopped();
            }}
          >
            {t.downloads.torrent.restart}
          </Button>
        </div>
      ) : null}
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
      <div role="group" aria-describedby={hintId}>
        <Switch
          label={t.downloads.settings.torrentDht}
          checked={dht}
          onChange={(on) => void setNetwork({ dht: on })}
        />
        <Switch
          label={t.downloads.settings.torrentUpnp}
          checked={upnp}
          onChange={(on) => void setNetwork({ upnp: on })}
        />
        <p id={hintId} className={styles.hint}>
          {t.downloads.torrent.deviceOnly}
        </p>
      </div>
      <TorrentIp />
      <AddTorrentDialog
        open={adding}
        defaultFolder={device.folder}
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
