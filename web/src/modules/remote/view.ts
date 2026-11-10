import type { RemotePcState } from '@/core/platform/types';
import type { RemoteView } from '@/core/remote/session';
import { t } from '@/strings';

/** The one step a state offers. */
export type RemoteStep = 'retry' | 'pair' | 'disable';

export interface RemoteLine {
  /** What is going on, in one or two calm sentences. */
  text: string;
  step?: RemoteStep;
  /** The media buttons can be used (a touch sends, or reconnects and sends). */
  usable: boolean;
}

/**
 * Every state of the session as its sentence and its one step (concept
 * `docs/design/remote-control/CONCEPT.md` §7). `last` is the PC's last known state: an unconnected
 * session keeps showing it quietly instead of an error.
 */
export function describe(view: RemoteView, last: RemotePcState | undefined): RemoteLine {
  const r = t.remote.state;
  switch (view.kind) {
    case 'connected':
      return { text: pcLine(view.pc), usable: true };
    case 'idle':
    case 'connecting':
      return { text: r.connecting, usable: true };
    case 'disconnected':
      return { text: last ? pcLine(last) : r.connecting, usable: true };
    case 'slow':
      return { text: r.slow, step: 'retry', usable: true };
    case 'not-paired':
      return { text: r.notPaired, step: 'pair', usable: false };
    case 'unreachable':
      return { text: r.unreachable, step: 'retry', usable: false };
    case 'no-input-here':
      return { text: r.noInputHere, step: 'retry', usable: false };
    case 'too-old':
      return { text: r.tooOld, step: 'retry', usable: false };
    case 'retry':
      return { text: r.retry, step: 'retry', usable: false };
    case 'refused':
      switch (view.reason) {
        case 'remote-off':
        case 'not-granted':
          return { text: r.notGranted, step: 'retry', usable: false };
        case 'paused':
        case 'ended':
          return { text: r.paused, step: 'retry', usable: false };
        case 'busy':
          return { text: r.busy, step: 'retry', usable: false };
        case 'unsupported':
          return { text: r.unsupported, step: 'disable', usable: false };
        case 'locked':
          return { text: r.locked, step: 'retry', usable: false };
        case 'limit':
          return { text: r.limit, step: 'retry', usable: false };
      }
  }
}

/** The PC's state in words: volume (or "Ton aus"), and that it is locked. */
export function pcLine(pc: RemotePcState): string {
  const r = t.remote.state;
  const sound = pc.mute ? r.muted : pc.volume === null ? r.volumeUnknown : r.volume(pc.volume);
  return pc.locked ? `${sound} · ${r.pcLocked}` : sound;
}
