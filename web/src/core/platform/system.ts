/** Contract of the system module's native side (`src-tauri/src/system.rs`). Read-only. */

export interface CpuInfo {
  brand: string;
  physicalCores: number | null;
  threads: number;
  /** Average load over all threads, 0–100. */
  usagePercent: number;
  /** Current clock in MHz when the system reports it. */
  frequencyMhz?: number | null;
}

export interface BatteryInfo {
  percent: number | null;
  charging: boolean;
  pluggedIn: boolean;
}

export interface GpuInfo {
  name: string;
  /** Own video memory; 0 for integrated adapters (they borrow `sharedBytes`). */
  dedicatedBytes: number;
  sharedBytes?: number;
  driverVersion?: string | null;
  vendor?: string | null;
  /** The adapter that drives a screen. */
  active?: boolean;
}

export type NetKind = 'ethernet' | 'wifi' | 'virtual' | 'other';

export interface NetIface {
  name: string;
  kind: NetKind;
  /** Connected. */
  up: boolean;
  ipv4: string[];
  /** The one useful IPv6 address (no link-local, no temporary ones). */
  ipv6: string | null;
  /** Everything else, behind "alle anzeigen". */
  ipv6Other: string[];
  /** Wi-Fi only; null when Windows does not tell (e.g. no location permission). */
  ssid: string | null;
  signalPercent: number | null;
  downBytesPerSec: number | null;
  upBytesPerSec: number | null;
}

export interface RamModule {
  sizeBytes: number;
  speedMhz: number | null;
  /** "DDR4", "DDR5", … */
  kind: string | null;
  manufacturer: string | null;
}

export interface DisplayInfo {
  width: number;
  height: number;
  refreshHz: number;
  primary: boolean;
}

/** Slowly changing facts. */
export interface HardwareInfo {
  board: string | null;
  bios: string | null;
  ram: RamModule[];
  windowsBuild: string | null;
  displays: DisplayInfo[];
  audioOutput: string | null;
  audioInput: string | null;
}

export interface SystemInfo {
  os: string;
  uptimeSecs: number;
  /** Start of the last boot, seconds since 1970. */
  bootTimeSecs: number;
  cpu: CpuInfo;
  memory: { totalBytes: number; usedBytes: number };
  /** `null` on machines without a battery. */
  battery: BatteryInfo | null;
  gpus: GpuInfo[];
  network: NetIface[];
  hardware: HardwareInfo;
}

export interface ProcInfo {
  name: string;
  memoryBytes: number;
  instances: number;
  /** Share of the whole CPU, 0–100 (0 until the second reading). */
  cpuPercent: number;
}

/** Read and write speed of one volume since the previous reading. */
export interface DiskIo {
  root: string;
  readBytesPerSec: number;
  writeBytesPerSec: number;
}

/** How worn the battery is (capacities as the battery reports them, mWh). */
export interface BatteryHealth {
  designMwh: number;
  fullMwh: number;
  /** `null` when the battery does not count its cycles. */
  cycles: number | null;
}

/** The computer went down without shutting down: a blue screen (with its stop code) or power loss / a freeze. */
export interface Crash {
  /** Seconds since 1970. */
  atSecs: number;
  kind: 'bluescreen' | 'unexpected';
  /** `0x0000009F`; only for a blue screen. Never a message, a driver or a path. */
  code: string | null;
}

/** Slow facts, read once per visit (`system_health`). */
export interface SystemHealth {
  battery: BatteryHealth | null;
  /** Newest first, at most five, from the last 30 days. */
  crashes: Crash[];
  /** `false` = the event log could not be read; `crashes` then says nothing. */
  crashesRead: boolean;
}

/** Desktop only; `supported` is false in the browser and on Android. */
export interface SystemService {
  supported: boolean;
  info(): Promise<SystemInfo>;
  /** The programs using the most memory, biggest first. */
  processes(): Promise<ProcInfo[]>;
  /** Live read/write speed per volume (display only, nothing is stored). */
  diskIo(): Promise<DiskIo[]>;
  /** Battery wear and the last unexpected shutdowns (optional: absent where it cannot be read). */
  health?(): Promise<SystemHealth>;
  /** Opens the Windows Task Manager; Nemo itself never ends a program. */
  openTaskManager(): Promise<void>;
}
