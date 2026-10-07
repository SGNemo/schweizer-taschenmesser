/** E2E stand-in for the native system facts (only wired in `--mode e2e` builds): invented values. */
import type { DiskIo, ProcInfo, SystemInfo, SystemService } from './system';

const GB = 1024 ** 3;
const MB = 1024 ** 2;

export function createFakeSystem(): SystemService {
  let n = 0;
  return {
    supported: true,
    async info(): Promise<SystemInfo> {
      n++;
      return {
        os: 'Beispiel-Betriebssystem 11',
        uptimeSecs: 3 * 86_400 + 5 * 3600 + 7 * 60,
        bootTimeSecs: 1_749_700_000,
        cpu: {
          brand: 'Beispiel-Prozessor 3000',
          physicalCores: 8,
          threads: 16,
          usagePercent: 10 + (n % 5),
          frequencyMhz: 4200,
        },
        memory: { totalBytes: 16 * GB, usedBytes: 9.5 * GB },
        battery: { percent: 64, charging: true, pluggedIn: true },
        gpus: [
          {
            name: 'Beispiel-Grafik 4000',
            dedicatedBytes: 12 * GB,
            sharedBytes: 16 * GB,
            driverVersion: '31.0.15.5123',
            vendor: 'Beispiel GmbH',
            active: true,
          },
          {
            name: 'Beispiel-Prozessorgrafik',
            dedicatedBytes: 0,
            sharedBytes: 8 * GB,
            driverVersion: '31.0.101.4502',
            vendor: 'Beispiel GmbH',
            active: false,
          },
        ],
        network: [
          {
            name: 'WLAN',
            kind: 'wifi',
            up: true,
            ipv4: ['192.168.1.20'],
            ipv6: '2001:db8::20',
            ipv6Other: ['2001:db8::abcd', '2001:db8::dead'],
            ssid: 'Beispiel-WLAN',
            signalPercent: 78,
            downBytesPerSec: 1.5 * MB + n * 1000,
            upBytesPerSec: 120 * 1024,
          },
          {
            name: 'vEthernet (WSL)',
            kind: 'virtual',
            up: true,
            ipv4: ['172.20.0.1'],
            ipv6: null,
            ipv6Other: [],
            ssid: null,
            signalPercent: null,
            downBytesPerSec: 0,
            upBytesPerSec: 0,
          },
        ],
        hardware: {
          board: 'Beispiel Mainboard B650',
          bios: 'Beispiel BIOS F31',
          ram: [
            { sizeBytes: 8 * GB, speedMhz: 6000, kind: 'DDR5', manufacturer: 'Beispiel' },
            { sizeBytes: 8 * GB, speedMhz: 6000, kind: 'DDR5', manufacturer: 'Beispiel' },
          ],
          windowsBuild: '24H2 · Build 26100.1',
          displays: [{ width: 2560, height: 1440, refreshHz: 144, primary: true }],
          audioOutput: 'Beispiel-Lautsprecher',
          audioInput: 'Beispiel-Mikrofon',
        },
      };
    },
    async processes(): Promise<ProcInfo[]> {
      return [
        { name: 'browser.exe', memoryBytes: 2.1 * GB, instances: 14, cpuPercent: 4.2 },
        { name: 'editor.exe', memoryBytes: 0.6 * GB, instances: 1, cpuPercent: 0.4 },
        { name: 'dienst.exe', memoryBytes: 0.2 * GB, instances: 3, cpuPercent: 0 },
      ];
    },
    async diskIo(): Promise<DiskIo[]> {
      return [{ root: 'C:\\', readBytesPerSec: 3 * MB, writeBytesPerSec: 1 * MB }];
    },
    async openTaskManager() {
      (globalThis as { __tmTaskManagerOpened?: number }).__tmTaskManagerOpened = n;
    },
  };
}
