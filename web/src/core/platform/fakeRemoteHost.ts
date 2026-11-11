/**
 * E2E stand-in for the PC side of remote control (`src-tauri/src/remote.rs`), which a browser test
 * cannot start. Only wired up in `--mode e2e` builds (see `web.ts`), and only for pages that set
 * `localStorage['tm-e2e-remotehost'] = '1'`. It follows the same rules as the shell: every widening
 * is "asked at the PC" (the test decides the answer through `window.__tmRemoteHost`), a narrowing
 * never asks, nothing widens while mouse and keyboard are controlled, "end" pauses the device.
 */
import type {
  RemoteHostDevice,
  RemoteHostGrant,
  RemoteHostService,
  RemoteHostStatus,
  RemoteLevel,
} from './types';

const E2E_FLAG = 'tm-e2e-remotehost';
const RANK: Record<RemoteLevel, number> = { off: 0, media: 1, full: 2 };

const widens = (next: RemoteHostGrant, old: RemoteHostGrant): boolean =>
  RANK[next.level] > RANK[old.level] ||
  (old.paused && !next.paused) ||
  (old.unlock && !next.unlock);

/** The fake and its test hooks (unit tests use them directly). */
export function createFakeRemoteHostParts() {
  let running = true;
  let supported = true;
  let enabled = false;
  let notice = true;
  let answer: 'allow' | 'cancel' = 'allow';
  let asked = 0;
  let failNext: string | undefined;
  let controller: { id: string; level: RemoteLevel } | null = null;
  const devices: RemoteHostDevice[] = [];

  const needRunning = () => {
    if (!running) throw new Error('not-started');
  };
  /** A change the shell refuses with a given code (once), as the test arranged. */
  const mayFail = () => {
    const code = failNext;
    failNext = undefined;
    if (code) throw new Error(code);
  };
  /** The native question: counted, answered by the test, refused while mouse/keyboard are controlled. */
  const ask = () => {
    if (controller?.level === 'full') throw new Error('busy-controlled');
    asked += 1;
    if (answer === 'cancel') throw new Error('cancelled');
  };
  const status = (): RemoteHostStatus => {
    const who = controller ? devices.find((d) => d.id === controller?.id) : undefined;
    return {
      supported,
      enabled,
      notice,
      controller:
        controller && who ? { id: who.id, name: who.name, level: controller.level } : null,
      devices: devices.map((d) => ({ ...d })),
    };
  };

  const host: RemoteHostService = {
    supported: true,
    status: async () => {
      needRunning();
      return status();
    },
    setEnabled: async (on) => {
      needRunning();
      if (!on) {
        enabled = false;
        controller = null;
        return;
      }
      if (enabled) return;
      if (devices.some((d) => d.level !== 'off' && !d.paused)) ask();
      enabled = true;
    },
    setDevice: async (id, grant) => {
      needRunning();
      const device = devices.find((d) => d.id === id);
      if (!device) throw new Error('not-found');
      mayFail();
      if (widens(grant, device)) ask();
      Object.assign(device, grant);
      if (controller?.id === id) controller = null;
    },
    setNotice: async (on) => {
      needRunning();
      // off loosens an option: asked at the PC like every widening
      if (!on && notice) ask();
      notice = on;
    },
    end: async () => {
      needRunning();
      if (!controller) return false;
      const device = devices.find((d) => d.id === controller?.id);
      if (device) device.paused = true;
      controller = null;
      return true;
    },
  };

  const hooks = {
    /** The hub runs (default) or not (`remote_status` answers `not-started`). */
    setRunning(on: boolean) {
      running = on;
    },
    /** This PC can be controlled (default) or not (a desktop that is not Windows). */
    setSupported(on: boolean) {
      supported = on;
    },
    addDevice(name: string, lastSeen: number | null = null): string {
      const id = `dev${devices.length + 1}`.padEnd(64, '0');
      devices.push({ id, name, lastSeen, level: 'off', paused: false, unlock: true });
      return id;
    },
    /** What the person answers in the "Windows dialog" from now on. */
    answer(next: 'allow' | 'cancel') {
      answer = next;
    },
    /** The next change of a device is refused with this code (`busy`, `changed`, …). */
    failNext(code: string) {
      failNext = code;
    },
    /** A device disappears (unpaired in another window). */
    removeDevice(id: string) {
      const at = devices.findIndex((d) => d.id === id);
      if (at >= 0) devices.splice(at, 1);
    },
    /** How many questions were shown at the PC. */
    asked: () => asked,
    /** A device opens a session; `false` if the switch or its grant does not allow it. */
    open(id: string, level: RemoteLevel = 'media'): boolean {
      const device = devices.find((d) => d.id === id);
      if (!enabled || !device || device.paused || RANK[device.level] < RANK[level]) return false;
      controller = { id, level };
      device.lastSeen = Math.floor(Date.now() / 1000);
      return true;
    },
    state: status,
  };
  return { host, hooks };
}

export function createFakeRemoteHost(): RemoteHostService {
  const { host: inner, hooks } = createFakeRemoteHostParts();
  const host: RemoteHostService = {
    ...inner,
    get supported() {
      try {
        return localStorage.getItem(E2E_FLAG) === '1';
      } catch {
        return false;
      }
    },
  };
  if (typeof window !== 'undefined')
    (window as unknown as { __tmRemoteHost?: unknown }).__tmRemoteHost = hooks;
  return host;
}
