/** `dev` exists only in Dev-Preview builds (`buildInfo.ts`); it is never stored as a preference. */
export type UpdateChannel = 'stable' | 'beta' | 'dev';

/** A newer version that can be installed. */
export interface UpdateInfo {
  /** SemVer without a leading "v". */
  version: string;
  /** Release notes (Markdown text from the GitHub release). */
  notes: string;
  prerelease: boolean;
  publishedAt?: string;
  /** Platform specific data the same `UpdateService` needs again in `install` (never interpreted elsewhere). */
  payload?: unknown;
}

export interface InstallProgress {
  downloaded: number;
  /** 0 while unknown. */
  total: number;
}

/**
 * - `restarting`: the payload was installed, the app restarts (desktop)
 * - `installer-opened`: the system installer took over (Android)
 * - `needs-permission`: Android must first be allowed to install apps; the user retries afterwards
 */
export type InstallResult = 'restarting' | 'installer-opened' | 'needs-permission';

/** Self-update of the installed app. The browser build has none (the service worker updates the PWA). */
export interface UpdateService {
  readonly supported: boolean;
  /** Resolves to a newer version on the channel, or undefined when up to date. */
  check(channel: UpdateChannel, currentVersion: string): Promise<UpdateInfo | undefined>;
  install(
    info: UpdateInfo,
    onProgress?: (progress: InstallProgress) => void,
  ): Promise<InstallResult>;
}
