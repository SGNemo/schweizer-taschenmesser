/**
 * Self-update for the native app.
 *
 * Desktop: the Rust side (`src-tauri/src/update.rs`, on `tauri-plugin-updater`) downloads and
 * installs; the plugin verifies the minisign signature, so nothing unsigned can be installed. On
 * Windows the app is one portable executable: the plugin only checks + downloads, `portable.rs`
 * re-verifies and swaps the running file (errors arrive as `<code>: <detail>` strings).
 * Android: no store and no updater plugin – the release APK is downloaded by the `apk-installer`
 * plugin, its SHA-256 (from the release's `.sha256` asset) is checked, and the system installer
 * takes over; Android itself only accepts an APK signed with our keystore.
 */
import { Channel, invoke } from '@tauri-apps/api/core';
import type { PlatformKind } from '../types';
import {
  APK_ASSET_PAIRS,
  DEV_APK_PAIR,
  DEV_MANIFEST_URL,
  MANIFEST_ASSET,
  STABLE_MANIFEST_URL,
  assetUrl,
  fetchDevManifest,
  fetchReleases,
  parseSha256,
  pickUpdate,
  versionOf,
} from '@/core/update/github';
import { isNewer, isPrerelease } from '@/core/update/semver';
import type { InstallProgress, UpdateInfo, UpdateService } from '@/core/update/types';

interface DesktopMeta {
  version: string;
  notes?: string | null;
  date?: string | null;
}

type DownloadEvent =
  | { event: 'started'; data: { contentLength?: number | null } }
  | { event: 'progress'; data: { chunkLength: number } }
  | { event: 'finished' };

export function createDesktopUpdater(fetchFn: typeof fetch): UpdateService {
  return {
    supported: true,
    async check(channel, current) {
      let endpoint: string | undefined = channel === 'dev' ? DEV_MANIFEST_URL : STABLE_MANIFEST_URL;
      if (channel === 'beta') {
        // The newest release of any kind carries its own manifest.
        const release = pickUpdate(await fetchReleases(fetchFn), 'beta', current);
        endpoint = release && assetUrl(release, MANIFEST_ASSET);
        if (!endpoint) return undefined;
      }
      const meta = await invoke<DesktopMeta | null>('check_update', { endpoint });
      if (!meta || !isNewer(meta.version, current)) return undefined;
      return {
        version: meta.version,
        notes: meta.notes ?? '',
        prerelease: isPrerelease(meta.version),
        publishedAt: meta.date ?? undefined,
      };
    },
    async install(_info, onProgress) {
      const channel = new Channel<DownloadEvent>();
      const progress: InstallProgress = { downloaded: 0, total: 0 };
      channel.onmessage = (message) => {
        if (message.event === 'started') progress.total = message.data.contentLength ?? 0;
        else if (message.event === 'progress') progress.downloaded += message.data.chunkLength;
        onProgress?.({ ...progress });
      };
      await invoke('install_update', { onEvent: channel });
      return 'restarting';
    },
  };
}

interface AndroidPayload {
  apkUrl: string;
  sha256Url: string;
}

const PROGRESS_POLL_MS = 500;

export function createAndroidUpdater(fetchFn: typeof fetch): UpdateService {
  return {
    supported: true,
    async check(channel, current) {
      if (channel === 'dev') {
        const manifest = await fetchDevManifest(fetchFn);
        if (!isNewer(manifest.version, current)) return undefined;
        return {
          version: manifest.version,
          notes: manifest.notes,
          prerelease: true,
          payload: {
            apkUrl: DEV_APK_PAIR.apk,
            sha256Url: DEV_APK_PAIR.sha256,
          } satisfies AndroidPayload,
        };
      }
      const release = pickUpdate(await fetchReleases(fetchFn), channel, current);
      if (!release) return undefined;
      // Without both the APK and its checksum the release is not installable from inside the app.
      let apkUrl: string | undefined;
      let sha256Url: string | undefined;
      for (const pair of APK_ASSET_PAIRS) {
        apkUrl = assetUrl(release, pair.apk);
        sha256Url = assetUrl(release, pair.sha256);
        if (apkUrl && sha256Url) break;
      }
      if (!apkUrl || !sha256Url) return undefined;
      const version = versionOf(release);
      const info: UpdateInfo = {
        version,
        notes: release.body ?? '',
        prerelease: isPrerelease(version),
        publishedAt: release.published_at ?? undefined,
        payload: { apkUrl, sha256Url } satisfies AndroidPayload,
      };
      return info;
    },
    async install(info, onProgress) {
      const payload = info.payload as AndroidPayload | undefined;
      if (!payload) throw new Error('update has no download information');

      const res = await fetchFn(payload.sha256Url, { signal: AbortSignal.timeout(20_000) });
      const sha256 = res.ok ? parseSha256(await res.text()) : undefined;
      if (!sha256) throw new Error('missing or malformed checksum');

      const poll = setInterval(() => {
        void invoke<InstallProgress>('plugin:apk-installer|download_progress')
          .then((p) => onProgress?.(p))
          .catch(() => undefined);
      }, PROGRESS_POLL_MS);
      let path: string;
      try {
        ({ path } = await invoke<{ path: string }>('plugin:apk-installer|download', {
          request: { url: payload.apkUrl, sha256 },
        }));
      } finally {
        clearInterval(poll);
      }
      const { status } = await invoke<{ status: string }>('plugin:apk-installer|install', {
        request: { path },
      });
      return status === 'needs-permission' ? 'needs-permission' : 'installer-opened';
    },
  };
}

export function createUpdater(kind: PlatformKind, fetchFn: typeof fetch): UpdateService {
  return kind === 'android' ? createAndroidUpdater(fetchFn) : createDesktopUpdater(fetchFn);
}
