/**
 * Why the built-in local model is missing in this app, in words the user can act on. The shell only
 * says `platform`, `build` or `cpu`; the UI also needs to know whether this is the browser, Android or
 * the Dev-Preview (which may be built without the model), because the next step differs for each.
 */
import type { LocalModelStatus } from '@/core/platform/localModel';
import type { PlatformKind } from '@/core/platform/types';
import type { BuildChannel } from '@/core/update/buildInfo';

/** `testBuild` = Dev-Preview without the model; `build` = any other build without it. */
export type LocalModelGap = 'browser' | 'android' | 'testBuild' | 'build' | 'cpu';

export function localModelGap(
  status: Pick<LocalModelStatus, 'unavailable'>,
  kind: PlatformKind,
  channel: BuildChannel,
): LocalModelGap | undefined {
  switch (status.unavailable) {
    case undefined:
      return undefined;
    case 'cpu':
      return 'cpu';
    case 'build':
      return channel === 'dev' ? 'testBuild' : 'build';
    case 'platform':
      return kind === 'android' ? 'android' : kind === 'web' ? 'browser' : 'build';
  }
}

/**
 * Can the user get the model here (download it in Settings → Lokales Modell)? Hints that send the
 * user there (Ollama card, setup step) only appear when this is true. Unknown status → false.
 */
export function localModelOffered(
  status: Pick<LocalModelStatus, 'unavailable'> | undefined,
): boolean {
  return status !== undefined && !status.unavailable;
}
