/** Contract of the system module's native side (`src-tauri/src/system.rs`). Read-only. */

export interface CpuInfo {
  brand: string;
  physicalCores: number | null;
  threads: number;
  /** Average load over all threads, 0–100. */
  usagePercent: number;
}

export interface BatteryInfo {
  percent: number | null;
  charging: boolean;
  pluggedIn: boolean;
}

export interface GpuInfo {
  name: string;
  dedicatedBytes: number;
}

export interface NetIface {
  name: string;
  addresses: string[];
}

export interface SystemInfo {
  os: string;
  uptimeSecs: number;
  cpu: CpuInfo;
  memory: { totalBytes: number; usedBytes: number };
  /** `null` on machines without a battery. */
  battery: BatteryInfo | null;
  gpus: GpuInfo[];
  network: NetIface[];
}

export interface ProcInfo {
  name: string;
  memoryBytes: number;
  instances: number;
}

/** Desktop only; `supported` is false in the browser and on Android. */
export interface SystemService {
  supported: boolean;
  info(): Promise<SystemInfo>;
  /** The programs using the most memory, biggest first. */
  processes(): Promise<ProcInfo[]>;
}
