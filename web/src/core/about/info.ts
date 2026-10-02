/**
 * The facts shown in Settings → Über Nemo and exported with the diagnostics: one source for both.
 * Contains no user data and no secrets.
 */
import { getPlatform } from '@/core/platform';
import type { PlatformKind } from '@/core/platform/types';
import { BUILD_CHANNEL, BUILD_SHA, type BuildChannel } from '@/core/update/buildInfo';
import { t } from '@/strings';

export type InstallKind = 'portable' | 'installed' | 'apk' | 'pwa' | 'browser';

export interface AboutInfo {
  version: string;
  /** Short commit id; '' when the build was not made from a git checkout. */
  commit: string;
  /** 'YYYY-MM-DD' of the build; '' in tests. */
  buildDate: string;
  channel: BuildChannel;
  platform: PlatformKind;
  installKind: InstallKind;
  /** Desktop only. */
  dataDir?: string;
}

const fromDefine = (read: () => string): string => {
  try {
    return read();
  } catch {
    return ''; // not defined (unit tests)
  }
};

export const buildCommit = (): string =>
  BUILD_SHA || fromDefine(() => (typeof __BUILD_SHA__ === 'string' ? __BUILD_SHA__ : ''));
export const buildDate = (): string =>
  fromDefine(() => (typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : ''));
/** This version's changelog section (Markdown), '' if the build has none. */
export const buildChangelog = (): string =>
  fromDefine(() => (typeof __CHANGELOG__ === 'string' ? __CHANGELOG__ : ''));

async function installKind(kind: PlatformKind): Promise<InstallKind> {
  if (kind === 'android') return 'apk';
  if (kind === 'desktop') {
    const info = await getPlatform()
      .desktop.info()
      .catch(() => ({ portable: false }));
    return info.portable ? 'portable' : 'installed';
  }
  const standalone =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  return standalone ? 'pwa' : 'browser';
}

export async function getAboutInfo(): Promise<AboutInfo> {
  const platform = getPlatform();
  const [version, kind, dataDir] = await Promise.all([
    platform.app.version(),
    installKind(platform.kind),
    platform.kind === 'desktop' ? platform.desktop.dataDir().catch(() => undefined) : undefined,
  ]);
  return {
    version,
    commit: buildCommit(),
    buildDate: buildDate(),
    channel: BUILD_CHANNEL,
    platform: platform.kind,
    installKind: kind,
    ...(dataDir ? { dataDir } : {}),
  };
}

/** "0.3.1" or, in a Dev-Preview build, "Dev-Preview 0.3.1 (abc1234)". */
export function versionLabel(info: Pick<AboutInfo, 'version' | 'channel' | 'commit'>): string {
  return info.channel === 'dev'
    ? t.update.settings.devVersion(info.version || '…', info.commit)
    : info.version || '…';
}
